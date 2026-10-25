import { Meilisearch } from 'meilisearch'
import type { Embedders, Settings, Task } from 'meilisearch'
import searchConfig from '#config/search'
import SearchEngine from '#services/search/search_engine'
import { SearchTaskFailedException } from '#exceptions/search_errors'
import {
  SEARCH_EMBEDDER,
  type ProductSearchDocument,
  type ProductSearchFilter,
  type ProductSearchHits,
  type ProductSearchRequest,
} from '#shared/types/search'

/**
 * Embedder `rest` de Meilisearch (ADR 0002, décision 3) : Meilisearch appelle
 * l'API d'embeddings (Mistral, ou tout endpoint compatible OpenAI) pour les
 * fiches — il vectorise `embeddingText` — et pour les requêtes. Le format de
 * requête et de réponse est celui de l'API OpenAI `/embeddings`, que Mistral
 * partage : `input` reçoit un lot de textes, `data[].embedding` les vecteurs.
 *
 * `null` quand l'embedder est coupé : appliqué aux réglages, il retire un
 * embedder existant, et la recherche redevient par mots-clés seuls.
 */
export function buildEmbedders(embedder: typeof searchConfig.embedder): Embedders {
  if (!embedder.enabled) return null

  return {
    [SEARCH_EMBEDDER]: {
      source: 'rest',
      url: embedder.url,
      apiKey: embedder.apiKey,
      dimensions: embedder.dimensions,
      documentTemplate: '{{ doc.embeddingText }}',
      // Le défaut (400 octets) tronquerait le texte : ~1 500 caractères suffisent
      // pour nom, catégorie, facettes et début de description.
      documentTemplateMaxBytes: 2000,
      request: {
        model: embedder.model,
        input: ['{{text}}', '{{..}}'],
        // Les modèles OpenAI réduisent à la dimension demandée ; `mistral-embed`
        // produit toujours 1024 et refuserait le paramètre.
        ...(embedder.provider === 'mistral' ? {} : { dimensions: embedder.dimensions }),
      },
      response: { data: [{ embedding: '{{embedding}}' }, '{{..}}'] },
    },
  }
}

/**
 * Réglages de l'index produits.
 *
 * - `names` / `descriptions` sont des objets par langue : un seul attribut
 *   cherchable couvre toutes les langues, ajouter une langue ne change rien ici ;
 * - les attributs filtrables servent au ET exact côté moteur (facettes, pays,
 *   catégorie) ;
 * - l'embedder vectorise `embeddingText`, jamais les autres champs.
 */
export function productIndexSettings(): Settings {
  return {
    searchableAttributes: ['names', 'descriptions', 'reference'],
    filterableAttributes: [
      'categoryId',
      'supplierId',
      'madeInEurope',
      'originCountry',
      'attributeValueIds',
    ],
    embedders: buildEmbedders(searchConfig.embedder),
  }
}

const INDEX_NOT_FOUND = 'index_not_found'

/**
 * Filtre Meilisearch d'une recherche : une clause par critère, jointes par `AND`.
 * Les valeurs sont des entiers et des booléens construits ici — jamais du texte
 * de l'utilisateur —, donc sans échappement à prévoir. `attributeValueIds = 3
 * AND attributeValueIds = 7` exige les **deux** valeurs : le ET fiable.
 */
export function buildProductFilter(filter: ProductSearchFilter): string | undefined {
  const clauses: string[] = []
  if (filter.categoryId) clauses.push(`categoryId = ${Number(filter.categoryId)}`)
  if (filter.madeInEurope) clauses.push('madeInEurope = true')
  for (const valueId of filter.attributeValueIds ?? []) {
    clauses.push(`attributeValueIds = ${Number(valueId)}`)
  }
  return clauses.length > 0 ? clauses.join(' AND ') : undefined
}

/**
 * Meilisearch (instance Docker, cf. `docs/deploiement.md`). Le client est créé
 * à la première utilisation ; l'index et ses réglages sont garantis une fois par
 * processus.
 */
export default class MeilisearchEngine extends SearchEngine {
  readonly enabled = true

  #client?: Meilisearch
  #ready?: Promise<void>

  async upsert(documents: ProductSearchDocument[]): Promise<void> {
    if (documents.length === 0) return
    await this.ensureIndex()
    const index = this.client.index(searchConfig.index)
    // `addDocuments` remplace le document entier : une traduction retirée de la
    // base disparaît aussi de l'index (`updateDocuments` la fusionnerait).
    for (const task of index.addDocumentsInBatches(documents, searchConfig.batchSize)) {
      this.assertSucceeded(await task.waitTask(this.waitOptions))
    }
  }

  async search(request: ProductSearchRequest): Promise<ProductSearchHits> {
    // Pas de `ensureIndex` : une recherche ne crée rien. Un index absent (pas
    // encore de `search:reindex`) est une erreur que l'appelant traite en repli.
    // Hybride seulement si le sémantique pèse et que l'embedder existe : sinon
    // Meilisearch n'appelle pas l'API d'embeddings.
    const hybrid =
      request.semanticRatio > 0 && searchConfig.embedder.enabled
        ? { embedder: SEARCH_EMBEDDER, semanticRatio: request.semanticRatio }
        : undefined

    const response = await this.client.index(searchConfig.index).search(request.query, {
      filter: buildProductFilter(request.filter),
      page: request.page,
      hitsPerPage: request.perPage,
      attributesToRetrieve: ['id'],
      ...(hybrid ? { hybrid } : {}),
    })

    return {
      ids: response.hits.map((hit) => Number(hit.id)),
      total: response.totalHits ?? response.hits.length,
    }
  }

  async remove(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    await this.ensureIndex()
    const task = await this.client.index(searchConfig.index).deleteDocuments(ids)
    this.assertSucceeded(await this.client.tasks.waitForTask(task.taskUid, this.waitOptions))
  }

  async replaceAll(batches: AsyncIterable<ProductSearchDocument[]>): Promise<number> {
    await this.ensureIndex()
    const staging = `${searchConfig.index}_next`

    // Un index temporaire laissé par un passage interrompu repart de zéro.
    await this.client.deleteIndexIfExists(staging)
    await this.createIndexWithSettings(staging)

    let count = 0
    try {
      const target = this.client.index(staging)
      for await (const batch of batches) {
        if (batch.length === 0) continue
        for (const task of target.addDocumentsInBatches(batch, searchConfig.batchSize)) {
          this.assertSucceeded(await task.waitTask(this.waitOptions))
        }
        count += batch.length
      }

      const swap = await this.client.swapIndexes([
        { indexes: [searchConfig.index, staging], rename: false },
      ])
      this.assertSucceeded(await this.client.tasks.waitForTask(swap.taskUid, this.waitOptions))
    } finally {
      // Après l'échange, `staging` porte l'ancien contenu ; en cas d'échec, le
      // contenu partiel. Dans les deux cas il n'a plus d'utilité.
      await this.client.deleteIndexIfExists(staging)
    }
    return count
  }

  /** Crée l'index actif et applique ses réglages (une fois par processus). */
  private ensureIndex(): Promise<void> {
    this.#ready ??= this.createIndexWithSettings(searchConfig.index).catch((error) => {
      this.#ready = undefined
      throw error
    })
    return this.#ready
  }

  /**
   * Index existant : on réapplique seulement les réglages (idempotent, sans
   * effet s'ils n'ont pas changé). Absent : on le crée, clé primaire `id`.
   */
  private async createIndexWithSettings(uid: string): Promise<void> {
    try {
      await this.client.getIndex(uid)
    } catch (error) {
      if ((error as { cause?: { code?: string } }).cause?.code !== INDEX_NOT_FOUND) throw error
      const created = await this.client.createIndex(uid, { primaryKey: 'id' })
      this.assertSucceeded(await this.client.tasks.waitForTask(created.taskUid, this.waitOptions))
    }

    const settings = await this.client.index(uid).updateSettings(productIndexSettings())
    this.assertSucceeded(await this.client.tasks.waitForTask(settings.taskUid, this.waitOptions))
  }

  private assertSucceeded(task: Task): void {
    if (task.status !== 'succeeded') throw new SearchTaskFailedException(task.error?.message)
  }

  private get waitOptions() {
    return { timeout: searchConfig.taskTimeoutMs }
  }

  private get client(): Meilisearch {
    this.#client ??= new Meilisearch({ host: searchConfig.host!, apiKey: searchConfig.apiKey })
    return this.#client
  }
}
