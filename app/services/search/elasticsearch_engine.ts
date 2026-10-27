import { Client, errors } from '@elastic/elasticsearch'
import type { estypes } from '@elastic/elasticsearch'
import searchConfig from '#config/search'
import SearchEngine from '#services/search/search_engine'
import { SearchTaskFailedException } from '#exceptions/search_errors'
import { ORIGIN_ZONES } from '#shared/types/product'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import {
  FACET_FIELD_PREFIX,
  type FacetDistribution,
  type FacetDistributionRequest,
  type ProductSearchDocument,
  type ProductSearchFilter,
  type ProductSearchHits,
  type ProductSearchRequest,
} from '#shared/types/search'

/** Champ `semantic_text` : Elasticsearch y vectorise `embeddingText` (ADR 0004). */
const EMBEDDING_FIELD = 'embedding'

/** Nombre maximal de valeurs renvoyées par facette (`terms` agrégé). */
const FACET_VALUES_LIMIT = 200

/**
 * Analyzer Elasticsearch de chaque langue de contenu. Une langue absente de la
 * table, ou ajoutée plus tard, retombe sur `standard` (gabarit dynamique de
 * `buildIndexDefinition`) : ajouter une langue ne casse rien, elle est seulement
 * moins bien lemmatisée jusqu'à avoir son analyzer.
 */
const LOCALE_ANALYZERS: Record<ContentLocale, string> = {
  fr: 'french',
  en: 'english',
}

const SEARCHABLE_FIELDS = ['names.*^3', 'descriptions.*', 'reference^2']

/**
 * Définition (réglages + mapping) d'un index produits.
 *
 * - `names.<locale>` / `descriptions.<locale>` : un champ texte par langue avec
 *   son analyzer ; `names.*` / `descriptions.*` couvrent toutes les langues d'un
 *   seul motif de recherche ;
 * - `attributes.<slug>` : facettes aplaties, créées à la volée en `double` par un
 *   gabarit dynamique — aucune liste de slugs à connaître ni à synchroniser ;
 * - `embeddingText` est copié dans `embedding` (`semantic_text`) quand
 *   l'embedder est actif : Elasticsearch appelle alors l'endpoint d'inférence
 *   pour les fiches à l'indexation et pour la requête à la recherche.
 */
export function buildIndexDefinition(embedderEnabled: boolean, inferenceId: string) {
  const localeFields = (analyzer: (locale: ContentLocale) => string) =>
    Object.fromEntries(
      CONTENT_LOCALES.map((locale) => [locale, { type: 'text', analyzer: analyzer(locale) }])
    )

  return {
    settings: { number_of_shards: 1, number_of_replicas: 0 },
    mappings: {
      dynamic_templates: [
        {
          names_other_locales: {
            path_match: 'names.*',
            mapping: { type: 'text', analyzer: 'standard' },
          },
        },
        {
          descriptions_other_locales: {
            path_match: 'descriptions.*',
            mapping: { type: 'text', analyzer: 'standard' },
          },
        },
        {
          facets: { path_match: `${FACET_FIELD_PREFIX}.*`, mapping: { type: 'double' } },
        },
      ],
      properties: {
        id: { type: 'integer' },
        slug: { type: 'keyword' },
        reference: { type: 'text', analyzer: 'standard' },
        categoryId: { type: 'integer' },
        supplierId: { type: 'integer' },
        madeInEurope: { type: 'boolean' },
        originCountry: { type: 'keyword' },
        originZone: { type: 'keyword' },
        releasedAt: { type: 'long' },
        isEco: { type: 'boolean' },
        attributeValueIds: { type: 'integer' },
        names: { properties: localeFields((locale) => LOCALE_ANALYZERS[locale]) },
        descriptions: { properties: localeFields((locale) => LOCALE_ANALYZERS[locale]) },
        embeddingText: embedderEnabled
          ? { type: 'text', index: false, copy_to: EMBEDDING_FIELD }
          : { type: 'text', index: false },
        ...(embedderEnabled
          ? { [EMBEDDING_FIELD]: { type: 'semantic_text', inference_id: inferenceId } }
          : {}),
      },
    },
  }
}

/**
 * Clauses de filtre d'une recherche : toutes en `filter` (booléen exact, hors
 * score), donc jointes en ET. `attributeValueIds` produit **une clause par
 * valeur** : le produit doit les porter toutes (le ET fiable).
 */
export function buildProductFilters(filter: ProductSearchFilter): estypes.QueryDslQueryContainer[] {
  const clauses: estypes.QueryDslQueryContainer[] = []
  if (filter.categoryId) clauses.push({ term: { categoryId: Number(filter.categoryId) } })
  if (filter.madeInEurope) clauses.push({ term: { madeInEurope: true } })
  if (filter.isEco) clauses.push({ term: { isEco: true } })
  for (const valueId of filter.attributeValueIds ?? []) {
    clauses.push({ term: { attributeValueIds: Number(valueId) } })
  }
  // Provenance : les zones cochées se combinent en OU (un seul `terms`).
  const zones = (filter.originZones ?? []).filter((zone) => ORIGIN_ZONES.includes(zone))
  if (zones.length > 0) clauses.push({ terms: { originZone: zones } })
  if (typeof filter.releasedAfter === 'number') {
    clauses.push({ range: { releasedAt: { gte: Math.trunc(filter.releasedAfter) } } })
  }
  return clauses
}

/** Requête textuelle : tolérante aux fautes, ou `match_all` sans mots-clés. */
function textQuery(query: string): estypes.QueryDslQueryContainer {
  if (query.trim() === '') return { match_all: {} }
  return {
    multi_match: {
      query,
      fields: SEARCHABLE_FIELDS,
      fuzziness: 'AUTO',
      minimum_should_match: '2<75%',
    },
  }
}

/**
 * Corps de recherche. Mots-clés seuls : `bool` (texte + filtres). Hybride : un
 * retriever `linear` pondère BM25 `(1 − ratio)` et sémantique `ratio`, scores
 * normalisés (`minmax`), filtres appliqués aux deux branches — l'équivalent du
 * `semanticRatio` de l'ancien moteur.
 */
export function buildSearchBody(
  request: ProductSearchRequest,
  embedderEnabled: boolean
): estypes.SearchRequest {
  const filter = buildProductFilters(request.filter)
  const from = (request.page - 1) * request.perPage
  const base = { from, size: request.perPage, _source: false, track_total_hits: true }

  const hybrid = embedderEnabled && request.semanticRatio > 0 && request.query.trim() !== ''
  if (!hybrid) {
    return { ...base, query: { bool: { must: [textQuery(request.query)], filter } } }
  }

  return {
    ...base,
    retriever: {
      linear: {
        retrievers: [
          {
            retriever: { standard: { query: textQuery(request.query) } },
            weight: 1 - request.semanticRatio,
            normalizer: 'minmax',
          },
          {
            retriever: {
              standard: { query: { semantic: { field: EMBEDDING_FIELD, query: request.query } } },
            },
            weight: request.semanticRatio,
            normalizer: 'minmax',
          },
        ],
        filter,
        rank_window_size: Math.max(100, from + request.perPage),
      },
    },
  } as estypes.SearchRequest
}

/**
 * Elasticsearch managé (add-on Clever Cloud, ADR 0004). `products_<env>` est un
 * **alias** : il pointe vers un index concret horodaté, ce qui permet la
 * reconstruction atomique (`replaceAll`). Le mapping est immuable : un
 * changement de mapping passe par `search:reindex`.
 */
export default class ElasticsearchEngine extends SearchEngine {
  readonly enabled = true

  #client?: Client
  #ready?: Promise<void>

  async upsert(documents: ProductSearchDocument[]): Promise<void> {
    if (documents.length === 0) return
    await this.ensureIndex()
    await this.bulkIndex(searchConfig.index, documents)
  }

  async search(request: ProductSearchRequest): Promise<ProductSearchHits> {
    // Pas de `ensureIndex` : une recherche ne crée rien. Un alias absent (pas
    // encore de `search:reindex`) est une erreur que l'appelant traite en repli.
    const response = await this.client.search({
      index: searchConfig.index,
      ...buildSearchBody(request, searchConfig.embedder.enabled),
    })

    const total = response.hits.total
    return {
      ids: response.hits.hits.map((hit) => Number(hit._id)),
      total: typeof total === 'number' ? total : (total?.value ?? response.hits.hits.length),
    }
  }

  async facetDistribution(request: FacetDistributionRequest): Promise<FacetDistribution> {
    if (request.facets.length === 0) return {}

    const response = await this.client.search({
      index: searchConfig.index,
      size: 0,
      query: {
        bool: { must: [textQuery(request.query)], filter: buildProductFilters(request.filter) },
      },
      aggs: Object.fromEntries(
        request.facets.map((field) => [field, { terms: { field, size: FACET_VALUES_LIMIT } }])
      ),
    })

    const distribution: FacetDistribution = {}
    for (const field of request.facets) {
      const agg = response.aggregations?.[field] as
        | { buckets: Array<{ key: number | string; doc_count: number }> }
        | undefined
      distribution[field] = Object.fromEntries(
        (agg?.buckets ?? []).map((bucket) => [String(bucket.key), bucket.doc_count])
      )
    }
    return distribution
  }

  async remove(ids: number[]): Promise<void> {
    if (ids.length === 0) return
    await this.ensureIndex()
    const response = await this.client.bulk({
      operations: ids.map((id) => ({ delete: { _index: searchConfig.index, _id: String(id) } })),
    })
    // Un id déjà absent (404) n'est pas une erreur : la suppression est idempotente.
    this.assertBulk(response, { ignoreNotFound: true })
  }

  async replaceAll(batches: AsyncIterable<ProductSearchDocument[]>): Promise<number> {
    await this.ensureInference()
    const alias = searchConfig.index
    const staging = `${alias}_${Date.now()}`
    await this.createIndex(staging)

    let count = 0
    try {
      for await (const batch of batches) {
        if (batch.length === 0) continue
        await this.bulkIndex(staging, batch)
        count += batch.length
      }
      await this.client.indices.refresh({ index: staging })

      // Bascule atomique : l'alias quitte les anciens index et rejoint le nouveau
      // dans la même requête. Un alias absent n'a pas d'ancien index.
      const previous = await this.indicesOfAlias(alias)
      await this.client.indices.updateAliases({
        actions: [
          ...previous.map((index) => ({ remove: { index, alias } })),
          { add: { index: staging, alias } },
        ],
      })
      // Les index remplacés n'ont plus d'utilité une fois l'alias basculé.
      if (previous.length > 0) {
        await this.client.indices.delete({ index: previous, ignore_unavailable: true })
      }
    } catch (error) {
      // Échec en route : le contenu partiel est jeté, l'alias reste sur l'ancien index.
      await this.client.indices.delete({ index: staging, ignore_unavailable: true })
      throw error
    }
    return count
  }

  /** Crée l'index actif et son alias s'ils n'existent pas (une fois par processus). */
  private ensureIndex(): Promise<void> {
    this.#ready ??= this.createInitialIndex().catch((error) => {
      this.#ready = undefined
      throw error
    })
    return this.#ready
  }

  private async createInitialIndex(): Promise<void> {
    await this.ensureInference()
    const alias = searchConfig.index
    const existing = await this.indicesOfAlias(alias)
    if (existing.length > 0) return
    const concrete = `${alias}_${Date.now()}`
    await this.createIndex(concrete)
    await this.client.indices.putAlias({ index: concrete, name: alias })
  }

  private async createIndex(name: string): Promise<void> {
    const { settings, mappings } = buildIndexDefinition(
      searchConfig.embedder.enabled,
      searchConfig.elasticsearch.inferenceId
    )
    await this.client.indices.create({
      index: name,
      settings,
      mappings: mappings as estypes.MappingTypeMapping,
    })
  }

  /**
   * Endpoint d'inférence (Mistral) appelé par Elasticsearch pour vectoriser les
   * fiches et les requêtes. Créé une fois s'il manque ; la clé API vit dans le
   * cluster. Rien à faire quand l'embedder est coupé.
   */
  private async ensureInference(): Promise<void> {
    if (!searchConfig.embedder.enabled) return
    const id = searchConfig.elasticsearch.inferenceId
    try {
      await this.client.transport.request({ method: 'GET', path: `/_inference/${id}` })
    } catch (error) {
      if (!(error instanceof errors.ResponseError) || error.statusCode !== 404) throw error
      await this.client.transport.request({
        method: 'PUT',
        path: `/_inference/text_embedding/${id}`,
        body: {
          service: 'mistral',
          service_settings: {
            api_key: searchConfig.embedder.apiKey,
            model: searchConfig.embedder.model,
          },
        },
      })
    }
  }

  private async bulkIndex(index: string, documents: ProductSearchDocument[]): Promise<void> {
    // `index` remplace le document entier : une traduction retirée de la base
    // disparaît aussi de l'index.
    for (let start = 0; start < documents.length; start += searchConfig.batchSize) {
      const chunk = documents.slice(start, start + searchConfig.batchSize)
      const response = await this.client.bulk({
        operations: chunk.flatMap((document) => [
          { index: { _index: index, _id: String(document.id) } },
          document,
        ]),
      })
      this.assertBulk(response)
    }
  }

  private async indicesOfAlias(alias: string): Promise<string[]> {
    try {
      return Object.keys(await this.client.indices.getAlias({ name: alias }))
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) return []
      throw error
    }
  }

  private assertBulk(
    response: estypes.BulkResponse,
    options: { ignoreNotFound?: boolean } = {}
  ): void {
    if (!response.errors) return
    for (const item of response.items) {
      const result = item.index ?? item.create ?? item.update ?? item.delete
      if (!result?.error) continue
      if (options.ignoreNotFound && result.status === 404) continue
      throw new SearchTaskFailedException(result.error.reason ?? undefined)
    }
  }

  protected get client(): Client {
    const { url, username, password } = searchConfig.elasticsearch
    this.#client ??= new Client({
      node: url!,
      ...(username ? { auth: { username, password: password ?? '' } } : {}),
      requestTimeout: searchConfig.taskTimeoutMs,
    })
    return this.#client
  }
}
