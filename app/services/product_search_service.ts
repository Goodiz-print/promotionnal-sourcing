import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { ModelPaginator } from '@adonisjs/lucid/orm'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import searchConfig from '#config/search'
import Product from '#models/product'
import SearchEngine from '#services/search/search_engine'
import { applyProductRangeFilters } from '#services/product_range_filters'
import { newProductThreshold } from '#services/new_product_window'
import { MOQ_BUCKETS, PRICE_BUCKETS, type ProductDirectoryFilters } from '#shared/types/product'
import { attributeSelectionsToFilters, bucketsToRanges } from '#shared/helpers/numeric_ranges'
import type {
  ProductSearchFilter,
  ProductSearchHits,
  ProductSearchRequest,
} from '#shared/types/search'
import type { SearchTrace } from '#shared/types/search_event'

/** Paramètres d'une recherche du catalogue public. */
export interface CatalogueSearchOptions extends ProductDirectoryFilters {
  page: number
  perPage: number
}

/**
 * Recherche des produits par Meilisearch (#112, ADR 0002) : mots-clés + sémantique
 * (Meilisearch vectorise lui-même la requête), filtres exacts, puis
 * **rechargement depuis PostgreSQL**.
 *
 * Ce que le moteur renvoie n'est qu'une liste ordonnée d'identifiants. La base
 * reste juge de ce qu'on affiche : un produit retiré, rejeté ou d'une
 * organisation archivée depuis la dernière synchronisation est écarté ici, et
 * les facettes demandées sont revérifiées sur la page rechargée (le ET est donc
 * garanti deux fois, par le filtre du moteur puis par la base).
 *
 * Les méthodes renvoient `null` quand la recherche n'est pas disponible — moteur
 * inerte (pas de `MEILISEARCH_HOST`) ou injoignable : l'appelant affiche alors
 * l'état « recherche indisponible » (la recherche PostgreSQL a été retirée, #112).
 */
@inject()
export default class ProductSearchService {
  constructor(private engine: SearchEngine) {}

  get enabled(): boolean {
    return this.engine.enabled
  }

  /**
   * Résultats paginés du catalogue public pour une requête. `null` : recherche
   * indisponible, utiliser le repli. `trace`, si fourni, reçoit le mode réellement
   * utilisé (journal des recherches, #171).
   */
  async search(
    options: CatalogueSearchOptions,
    trace?: SearchTrace
  ): Promise<ModelPaginatorContract<Product> | null> {
    const query = options.search?.trim()
    if (!this.enabled || !query) {
      if (trace && query) trace.mode = 'unavailable'
      return null
    }

    const hits = await this.query(
      {
        query,
        semanticRatio: searchConfig.embedder.enabled ? searchConfig.semanticRatio : 0,
        filter: this.engineFilter(options),
        page: options.page,
        perPage: options.perPage,
      },
      trace
    )
    if (!hits) return null

    const products = await this.reload(hits.ids, options)
    return new ModelPaginator(hits.total, options.perPage, options.page, ...products)
  }

  /**
   * Parmi `productIds`, les produits qui répondent à la requête **et** à tous les
   * filtres — pour les produits sponsorisés (cf. `docs/ads.md`). Mots-clés seuls :
   * en hybride, tout produit « ressemble » un peu à la requête et rien ne serait
   * écarté ; ici le produit doit réellement contenir les termes cherchés. `null` :
   * recherche indisponible (aucun produit sponsorisé n'est alors affiché).
   */
  async matching(
    filters: ProductDirectoryFilters,
    productIds: number[]
  ): Promise<Product[] | null> {
    const query = filters.search?.trim()
    if (!this.enabled || !query) return null
    if (productIds.length === 0) return []

    const hits = await this.query({
      query,
      semanticRatio: 0,
      filter: { ...this.engineFilter(filters), ids: productIds },
      page: 1,
      perPage: productIds.length,
    })
    if (!hits) return null

    return this.reload(hits.ids, filters)
  }

  /** Filtres exacts du moteur pour ces filtres de catalogue. */
  private engineFilter(options: ProductDirectoryFilters): ProductSearchFilter {
    const threshold = newProductThreshold(options.newOnly)
    return {
      categoryId: options.categoryId,
      madeInEurope: options.madeInEurope,
      attributeValueIds: options.attributeValueIds,
      // Labels de conformité (écart 4, ÉTAPE 6) : ET exact.
      certificationIds: options.certificationIds,
      originZones: options.originZones,
      // Statut de stock (plan L98) : OU entre les statuts cochés.
      stockStatuses: options.stockStatuses,
      // Tranches numériques (plan L125) : prix, MOQ (buckets → intervalles) et
      // attributs EAV. OU entre tranches d'un même champ, ET entre champs.
      priceRanges: bucketsToRanges(options.priceBuckets, PRICE_BUCKETS),
      moqRanges: bucketsToRanges(options.moqBuckets, MOQ_BUCKETS),
      attributeRanges: attributeSelectionsToFilters(options.attributeRanges),
      releasedAfter: threshold ? Math.trunc(threshold.toSeconds()) : null,
      // Éco-responsable (écart 4).
      isEco: options.ecoOnly,
    }
  }

  /**
   * Produits proposés par le sélecteur d'une demande de devis : mots-clés seuls
   * (pas d'appel au provider d'embeddings à chaque frappe), au plus `limit`
   * résultats visibles. `null` : recherche indisponible, utiliser le repli.
   */
  async lookup(search: string, limit: number): Promise<Product[] | null> {
    const query = search.trim()
    if (!this.enabled || !query) return null

    const hits = await this.query({
      query,
      semanticRatio: 0,
      filter: {},
      page: 1,
      perPage: limit,
    })
    if (!hits) return null

    return this.reload(hits.ids, null, true)
  }

  /**
   * Interroge le moteur. Une recherche sémantique qui échoue — l'API d'embeddings
   * est indisponible ou limitée en débit, Meilisearch ne peut pas vectoriser la
   * requête — est **rejouée par mots-clés seuls** : la recherche ne tombe jamais
   * à cause de l'IA. Moteur injoignable, même en mots-clés : `null` (repli).
   */
  private async query(
    request: ProductSearchRequest,
    trace?: SearchTrace
  ): Promise<ProductSearchHits | null> {
    try {
      const hits = await this.engine.search(request)
      if (trace) trace.mode = request.semanticRatio > 0 ? 'semantic' : 'keyword'
      return hits
    } catch (error) {
      if (request.semanticRatio > 0) {
        logger.warn({ err: error }, 'semantic search failed, retrying with keywords only')
        return this.query({ ...request, semanticRatio: 0 }, trace)
      }
      logger.warn({ err: error }, 'search engine unavailable')
      if (trace) trace.mode = 'unavailable'
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
    // Labels de conformité (écart 4, ÉTAPE 6) : ET fiable, revérifié sur la base
    // (un `whereHas` par label → chaque contrainte est combinée en AND).
    for (const certificationId of filters?.certificationIds ?? []) {
      query.whereHas('certifications', (c) => c.where('certifications.id', certificationId))
    }
    // Provenance (écart 9) : OU entre zones cochées ; revérifié sur la base.
    const zones = filters?.originZones ?? []
    if (zones.length > 0) query.whereIn('originZone', zones)
    // Statut de stock (plan L98) : OU entre statuts cochés ; revérifié sur la base.
    const statuses = filters?.stockStatuses ?? []
    if (statuses.length > 0) query.whereIn('stockStatus', statuses)
    // Tranches numériques (plan L125) : prix, MOQ, attributs EAV ; `[min, max[`
    // revérifié sur la base (le ET est garanti deux fois, comme les autres facettes).
    if (filters) {
      applyProductRangeFilters(query, {
        priceBuckets: filters.priceBuckets,
        moqBuckets: filters.moqBuckets,
        attributeRanges: filters.attributeRanges,
      })
    }
    // Nouveautés (écart 5) : sorti depuis le seuil.
    const threshold = newProductThreshold(filters?.newOnly ?? false)
    if (threshold) query.where('releasedAt', '>=', threshold.toSQLDate()!)
    // Éco-responsable (écart 4) : revérifié sur la base.
    if (filters?.ecoOnly) query.where('isEco', true)
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
