import { Meilisearch } from 'meilisearch'
import type { Embedders, Settings, Task } from 'meilisearch'
import { inject } from '@adonisjs/core'
import searchConfig from '#config/search'
import SearchEngine from '#services/search/search_engine'
import FilterableFacetsService from '#services/filterable_facets_service'
import { SearchTaskFailedException } from '#exceptions/search_errors'
import { ORIGIN_ZONES, PRODUCT_STOCK_STATUSES } from '#shared/types/product'
import {
  CERTIFICATION_FACET_FIELD,
  STOCK_FACET_FIELD,
  PRICE_FACET_FIELD,
  MOQ_FACET_FIELD,
  facetField,
  SEARCH_EMBEDDER,
  type FacetDistribution,
  type FacetDistributionRequest,
  type NumericRangeFilter,
  type ProductSearchDocument,
  type ProductSearchFilter,
  type ProductSearchHits,
  type ProductSearchRequest,
} from '#shared/types/search'

/** Texte vectorisé : `embeddingText` de chaque document, rien d'autre. */
const DOCUMENT_TEMPLATE = '{{ doc.embeddingText }}'

/**
 * Embedder de l'index (ADR 0002, décision 3) : c'est Meilisearch qui calcule les
 * vecteurs, à partir de `embeddingText`, pour les fiches et pour les requêtes.
 *
 * - `huggingface` (défaut) : Meilisearch télécharge le modèle et le fait tourner
 *   lui-même, sans clé. Sa dimension est celle du modèle (non déclarée) ;
 * - `mistral` / `openai-compatible` : embedder `rest` appelant l'API
 *   d'embeddings. Le format est celui de l'API OpenAI `/embeddings`, que Mistral
 *   partage : `input` reçoit un lot de textes, `data[].embedding` les vecteurs.
 *
 * `null` quand l'embedder est coupé : appliqué aux réglages, il retire un
 * embedder existant, et la recherche redevient par mots-clés seuls.
 */
export function buildEmbedders(embedder: typeof searchConfig.embedder): Embedders {
  if (!embedder.enabled) return null

  // Le défaut (400 octets) tronquerait le texte : ~1 500 caractères suffisent
  // pour nom, catégorie, facettes et début de description.
  const documentTemplate = { documentTemplate: DOCUMENT_TEMPLATE, documentTemplateMaxBytes: 2000 }

  if (embedder.provider === 'huggingface') {
    return {
      [SEARCH_EMBEDDER]: { source: 'huggingFace', model: embedder.model, ...documentTemplate },
    }
  }

  return {
    [SEARCH_EMBEDDER]: {
      source: 'rest',
      url: embedder.url,
      apiKey: embedder.apiKey,
      dimensions: embedder.dimensions,
      ...documentTemplate,
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
 * - les facettes **aplaties par slug** (`attributes.<slug>`, `facetSlugs` dérivés
 *   de `category_attributes.is_filter`) sont filtrables et facettables : elles
 *   donnent les distributions par attribut (compteurs par valeur) ;
 * - l'embedder vectorise `embeddingText`, jamais les autres champs.
 */
export function productIndexSettings(facetSlugs: readonly string[] = []): Settings {
  return {
    searchableAttributes: ['names', 'descriptions', 'reference'],
    filterableAttributes: [
      'categoryId',
      'supplierId',
      'madeInEurope',
      'originCountry',
      // Provenance à 3 états (écart 9) et filtre « Nouveautés » (écart 5).
      'originZone',
      'releasedAt',
      // Filtre dérivé « Éco-responsable » (écart 4).
      'isEco',
      'attributeValueIds',
      // Labels de conformité (écart 4, ÉTAPE 6) : facette transverse aux
      // catégories, filtrable et facettable (distribution par label).
      CERTIFICATION_FACET_FIELD,
      // Statut de stock agrégé (plan L98) : facette transverse, filtrable.
      STOCK_FACET_FIELD,
      // Prix (palier le plus bas) et MOQ (plan L125) : facettes transverses à
      // buckets — filtre d'intervalle + distribution par valeur agrégée en tranches.
      PRICE_FACET_FIELD,
      MOQ_FACET_FIELD,
      ...facetSlugs.map(facetField),
    ],
    // Les facettes prix/MOQ sont transverses (tout le catalogue) : la distribution
    // d'un champ numérique porte une entrée par valeur distincte. Le défaut (100)
    // tronquerait le comptage des buckets dès que le catalogue dépasse 100 prix (ou
    // MOQ) distincts ; on relève le plafond pour que les compteurs restent exacts.
    faceting: { maxValuesPerFacet: 1000 },
    embedders: buildEmbedders(searchConfig.embedder),
  }
}

const INDEX_NOT_FOUND = 'index_not_found'

/**
 * Clause d'un filtre à tranches sur un champ numérique (plan L125) : chaque
 * tranche devient `(field >= min AND field < max)` (borne basse incluse, haute
 * exclue ; borne `null` omise), les tranches se combinant en **OU** et le tout
 * groupé pour rester en ET avec les autres critères. `undefined` si aucune tranche
 * exploitable. Les bornes sont des nombres finis construits par l'application,
 * jamais du texte utilisateur — aucun échappement à prévoir.
 *
 * ATTENTION — champ tableau : `attributes.<slug>` est un `number[]`. Sur un
 * attribut numérique **mono-valué** (cas réel), `>= min AND < max` équivaut à
 * `[min, max[`. Sur un multi-valué, Meilisearch satisfait chaque borne dès qu'**un**
 * élément la satisfait (deux éléments distincts pourraient donc valider la tranche).
 */
function rangeFieldClause(
  field: string,
  ranges: readonly NumericRangeFilter[]
): string | undefined {
  const parts: string[] = []
  for (const range of ranges) {
    const bounds: string[] = []
    if (typeof range.min === 'number' && Number.isFinite(range.min)) {
      bounds.push(`${field} >= ${range.min}`)
    }
    if (typeof range.max === 'number' && Number.isFinite(range.max)) {
      bounds.push(`${field} < ${range.max}`)
    }
    if (bounds.length === 0) continue
    parts.push(bounds.length > 1 ? `(${bounds.join(' AND ')})` : bounds[0])
  }
  if (parts.length === 0) return undefined
  return parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0]
}

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
  // Éco-responsable (écart 4) : filtre dérivé booléen.
  if (filter.isEco) clauses.push('isEco = true')
  for (const valueId of filter.attributeValueIds ?? []) {
    clauses.push(`attributeValueIds = ${Number(valueId)}`)
  }
  // Labels de conformité (écart 4, ÉTAPE 6) : ET exact comme les facettes —
  // une clause par label, `certificationIds = X AND certificationIds = Y` exige
  // les deux. Valeurs entières construites ici, jamais du texte utilisateur.
  for (const certificationId of filter.certificationIds ?? []) {
    clauses.push(`${CERTIFICATION_FACET_FIELD} = ${Number(certificationId)}`)
  }
  // Provenance (écart 9) : les zones cochées se combinent en OU (France OU
  // Europe), groupées pour rester en ET avec les autres critères. Les valeurs
  // sont des littéraux de l'enum construits ici, jamais du texte utilisateur.
  const zones = (filter.originZones ?? []).filter((zone) => ORIGIN_ZONES.includes(zone))
  if (zones.length > 0) {
    clauses.push(`(${zones.map((zone) => `originZone = '${zone}'`).join(' OR ')})`)
  }
  // Stock (plan L98) : les statuts cochés se combinent en OU (disponible OU sur
  // commande), groupés pour rester en ET avec les autres critères. Littéraux de
  // l'enum construits ici, jamais du texte utilisateur.
  const statuses = (filter.stockStatuses ?? []).filter((status) =>
    PRODUCT_STOCK_STATUSES.includes(status)
  )
  if (statuses.length > 0) {
    clauses.push(`(${statuses.map((status) => `${STOCK_FACET_FIELD} = '${status}'`).join(' OR ')})`)
  }
  // Tranches numériques (plan L125) : prix (palier le plus bas) et MOQ, facettes
  // transverses à buckets ; OU entre tranches d'un même champ, groupé.
  const priceClause = rangeFieldClause(PRICE_FACET_FIELD, filter.priceRanges ?? [])
  if (priceClause) clauses.push(priceClause)
  const moqClause = rangeFieldClause(MOQ_FACET_FIELD, filter.moqRanges ?? [])
  if (moqClause) clauses.push(moqClause)
  // Tranches d'attributs EAV (plan L125) : regroupées par slug (OU interne entre
  // tranches d'un même attribut, ET entre attributs). Champ tableau
  // `attributes.<slug>` — cf. `rangeFieldClause`.
  const rangesBySlug = new Map<string, NumericRangeFilter[]>()
  for (const range of filter.attributeRanges ?? []) {
    const list = rangesBySlug.get(range.slug) ?? []
    list.push({ min: range.min, max: range.max })
    rangesBySlug.set(range.slug, list)
  }
  for (const [slug, ranges] of rangesBySlug) {
    const clause = rangeFieldClause(facetField(slug), ranges)
    if (clause) clauses.push(clause)
  }
  // Nouveautés (écart 5) : sorti depuis le seuil (timestamp Unix en secondes).
  if (typeof filter.releasedAfter === 'number') {
    clauses.push(`releasedAt >= ${Math.trunc(filter.releasedAfter)}`)
  }
  return clauses.length > 0 ? clauses.join(' AND ') : undefined
}

/**
 * Meilisearch (instance Docker, cf. `docs/deploiement.md`). Le client est créé
 * à la première utilisation ; l'index et ses réglages sont garantis une fois par
 * processus.
 */
@inject()
export default class MeilisearchEngine extends SearchEngine {
  readonly enabled = true

  #client?: Meilisearch
  #ready?: Promise<void>

  /**
   * `facets` est injecté en production (conteneur IoC) ; optionnel pour pouvoir
   * piloter le moteur sans base dans les tests unitaires — la liste des slugs
   * filtrables est alors vide (réglages statiques seuls).
   */
  constructor(private facets?: FilterableFacetsService) {
    super()
  }

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

  async facetDistribution(request: FacetDistributionRequest): Promise<FacetDistribution> {
    if (request.facets.length === 0) return {}

    // `limit: 0` : on ne veut que les compteurs, aucun hit. Pas de `ensureIndex`
    // (lecture seule) ; un index absent est une erreur traitée par l'appelant.
    const response = await this.client.index(searchConfig.index).search(request.query, {
      filter: buildProductFilter(request.filter),
      facets: request.facets,
      limit: 0,
    })

    return response.facetDistribution ?? {}
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

    // Les attributs filtrables aplatis (`attributes.<slug>`) sont dérivés de la
    // base (`category_attributes.is_filter`) : un changement est appliqué au
    // prochain `search:reindex` (ou au premier envoi d'un nouveau processus).
    const facetSlugs = this.facets ? await this.facets.filterableSlugs() : []
    const settings = await this.client.index(uid).updateSettings(productIndexSettings(facetSlugs))
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
