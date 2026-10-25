import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { ModelPaginator } from '@adonisjs/lucid/orm'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import aiConfig from '#config/ai'
import searchConfig from '#config/search'
import Product from '#models/product'
import EmbeddingService from '#services/embedding_service'
import QueryVectorCache from '#services/search/query_vector_cache'
import SearchEngine from '#services/search/search_engine'
import type { ProductDirectoryFilters } from '#shared/types/product'
import type { ProductSearchHits } from '#shared/types/search'

/** Paramètres d'une recherche du catalogue public. */
export interface CatalogueSearchOptions extends ProductDirectoryFilters {
  page: number
  perPage: number
}

/**
 * Recherche des produits par Meilisearch (#112, ADR 0002) : mots-clés + vecteur
 * de la requête, filtres exacts, puis **rechargement depuis PostgreSQL**.
 *
 * Ce que le moteur renvoie n'est qu'une liste ordonnée d'identifiants. La base
 * reste juge de ce qu'on affiche : un produit retiré, rejeté ou d'une
 * organisation archivée depuis la dernière synchronisation est écarté ici, et
 * les facettes demandées sont revérifiées sur la page rechargée (le ET est donc
 * garanti deux fois, par le filtre du moteur puis par la base).
 *
 * Les méthodes renvoient `null` quand la recherche n'est pas disponible — moteur
 * inerte (pas de `MEILISEARCH_HOST`) ou injoignable : l'appelant retombe sur la
 * recherche PostgreSQL, qui disparaît avec la PR 3 de #112.
 */
@inject()
export default class ProductSearchService {
  constructor(
    private engine: SearchEngine,
    private embeddings: EmbeddingService,
    private cache: QueryVectorCache
  ) {}

  get enabled(): boolean {
    return this.engine.enabled
  }

  /**
   * Résultats paginés du catalogue public pour une requête. `null` : recherche
   * indisponible, utiliser le repli.
   */
  async search(options: CatalogueSearchOptions): Promise<ModelPaginatorContract<Product> | null> {
    const query = options.search?.trim()
    if (!this.enabled || !query) return null

    const vector = await this.queryVector(query)

    let hits: ProductSearchHits
    try {
      hits = await this.engine.search({
        query,
        vector,
        semanticRatio: searchConfig.semanticRatio,
        filter: {
          categoryId: options.categoryId,
          madeInEurope: options.madeInEurope,
          attributeValueIds: options.attributeValueIds,
        },
        page: options.page,
        perPage: options.perPage,
      })
    } catch (error) {
      logger.warn({ err: error }, 'search engine unavailable, falling back to postgres')
      return null
    }

    const products = await this.reload(hits.ids, options)
    return new ModelPaginator(hits.total, options.perPage, options.page, ...products)
  }

  /**
   * Produits proposés par le sélecteur d'une demande de devis : mots-clés seuls
   * (pas d'appel au provider d'embeddings à chaque frappe), au plus `limit`
   * résultats visibles. `null` : recherche indisponible, utiliser le repli.
   */
  async lookup(search: string, limit: number): Promise<Product[] | null> {
    const query = search.trim()
    if (!this.enabled || !query) return null

    let hits: ProductSearchHits
    try {
      hits = await this.engine.search({
        query,
        vector: null,
        semanticRatio: 0,
        filter: {},
        page: 1,
        perPage: limit,
      })
    } catch (error) {
      logger.warn({ err: error }, 'search engine unavailable, falling back to postgres')
      return null
    }

    return this.reload(hits.ids, null, true)
  }

  /**
   * Vecteur de la requête, ou `null` pour une recherche par mots-clés seuls :
   * vectorisation désactivée, provider en erreur — la recherche ne tombe jamais
   * à cause de l'IA. Mis en cache (provider et modèle dans la clé).
   */
  private async queryVector(query: string): Promise<number[] | null> {
    if (!aiConfig.embeddings.enabled) return null

    const key = this.embeddings.embeddingKey(query.toLowerCase())
    const cached = this.cache.get(key)
    if (cached) return cached

    try {
      const vector = await this.embeddings.embed(query)
      if (vector) this.cache.set(key, vector)
      return vector
    } catch (error) {
      logger.warn({ err: error }, 'query embedding failed, using keyword search only')
      return null
    }
  }

  /**
   * Recharge les produits retournés par le moteur depuis PostgreSQL, dans l'ordre
   * du moteur. Un identifiant dont le produit n'est plus visible, ou ne porte
   * plus les facettes demandées, disparaît de la page.
   */
  private async reload(
    ids: number[],
    filters: ProductDirectoryFilters | null,
    withSupplier = false
  ): Promise<Product[]> {
    if (ids.length === 0) return []

    const query = this.visible().whereIn('products.id', ids).preload('translations')
    if (filters?.categoryId) query.where('categoryId', filters.categoryId)
    if (filters?.madeInEurope) query.where('madeInEurope', true)
    for (const valueId of filters?.attributeValueIds ?? []) {
      query.whereHas('attributeValues', (av) => av.where('attribute_values.id', valueId))
    }
    if (withSupplier) query.preload('supplier', (supplier) => supplier.preload('organization'))

    const found = await query
    const byId = new Map(found.map((product) => [product.id, product]))
    return ids.flatMap((id) => {
      const product = byId.get(id)
      return product ? [product] : []
    })
  }

  /** Mêmes règles de visibilité que la fiche publique (`findBySlug`). */
  private visible() {
    return Product.query()
      .where('isActive', true)
      .withScopes((scopes) => {
        scopes.fromLiveOrganization()
        scopes.notRejected()
      })
  }
}
