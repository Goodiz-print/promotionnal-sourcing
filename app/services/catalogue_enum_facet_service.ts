import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import SearchEngine from '#services/search/search_engine'
import { newProductThreshold } from '#services/new_product_window'
import {
  MOQ_BUCKETS,
  PRICE_BUCKETS,
  type CatalogueEnumFacetsType,
  type EnumFacetCountsType,
  type ProductDirectoryFilters,
} from '#shared/types/product'
import {
  STOCK_FACET_FIELD,
  type FacetDistribution,
  type ProductSearchFilter,
} from '#shared/types/search'
import { attributeSelectionsToFilters, bucketsToRanges } from '#shared/helpers/numeric_ranges'

const ORIGIN_FACET_FIELD = 'originZone'

/**
 * Compteurs des facettes d'énumération **transverses** du catalogue (provenance,
 * stock), pour que la barre de filtres masque les options sans produit.
 *
 * Chaque distribution est cadrée par tous les autres critères de navigation
 * **sans** le critère compté : une option cochée garde ainsi un compteur, et les
 * autres restent non nulles (même raisonnement que les certifications).
 *
 * Moteur indisponible : `hasCounts: false`, l'UI affiche toutes les options.
 */
@inject()
export default class CatalogueEnumFacetService {
  constructor(private engine: SearchEngine) {}

  async forCatalogue(filters: ProductDirectoryFilters): Promise<CatalogueEnumFacetsType> {
    const none: EnumFacetCountsType = { counts: {}, hasCounts: false }
    if (!this.engine.enabled) return { origin: none, stock: none }

    const query = filters.search?.trim() || ''
    try {
      const [origin, stock] = await Promise.all([
        this.engine.facetDistribution({
          query,
          filter: this.scopingFilter(filters, 'origin'),
          facets: [ORIGIN_FACET_FIELD],
        }),
        this.engine.facetDistribution({
          query,
          filter: this.scopingFilter(filters, 'stock'),
          facets: [STOCK_FACET_FIELD],
        }),
      ])
      return {
        origin: this.counts(origin, ORIGIN_FACET_FIELD),
        stock: this.counts(stock, STOCK_FACET_FIELD),
      }
    } catch (error) {
      logger.warn(
        { err: error },
        'enum facet distribution unavailable, serving options without counts'
      )
      return { origin: none, stock: none }
    }
  }

  private counts(distribution: FacetDistribution, field: string): EnumFacetCountsType {
    return { counts: distribution[field] ?? {}, hasCounts: true }
  }

  /** Cadrage : tous les critères sauf celui dont on compte les valeurs. */
  private scopingFilter(
    filters: ProductDirectoryFilters,
    counting: 'origin' | 'stock'
  ): ProductSearchFilter {
    const threshold = newProductThreshold(filters.newOnly)
    return {
      categoryId: filters.categoryId,
      madeInEurope: filters.madeInEurope,
      attributeValueIds: filters.attributeValueIds,
      certificationIds: filters.certificationIds,
      originZones: counting === 'origin' ? [] : filters.originZones,
      stockStatuses: counting === 'stock' ? [] : filters.stockStatuses,
      priceRanges: bucketsToRanges(filters.priceBuckets, PRICE_BUCKETS),
      moqRanges: bucketsToRanges(filters.moqBuckets, MOQ_BUCKETS),
      attributeRanges: attributeSelectionsToFilters(filters.attributeRanges),
      releasedAfter: threshold ? Math.trunc(threshold.toSeconds()) : null,
      isEco: filters.ecoOnly,
    }
  }
}
