import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import SearchEngine from '#services/search/search_engine'
import {
  MOQ_BUCKETS,
  NEW_PRODUCT_WINDOW_DAYS,
  PRICE_BUCKETS,
  type CatalogueNumericFacetsType,
  type NumericBucket,
  type NumericFacetBarType,
  type ProductDirectoryFilters,
} from '#shared/types/product'
import { MOQ_FACET_FIELD, PRICE_FACET_FIELD, type ProductSearchFilter } from '#shared/types/search'
import {
  attributeSelectionsToFilters,
  bucketsToRanges,
  sumRangeCount,
} from '#shared/helpers/numeric_ranges'

/** Champ compté, exclu de son propre cadrage de distribution. */
type CountingField = 'price' | 'moq'

/**
 * Facettes numériques **transverses** du catalogue (plan L125) : prix (palier le
 * plus bas) et MOQ, rendues à buckets.
 *
 * Comme les certifications et le stock, ces facettes sont **transverses aux
 * catégories** (contrairement aux tranches d'attributs EAV, dépendantes de la
 * catégorie et portées par `CatalogueFacetBarService`) : la barre est donc
 * **globale** — disponible sans catégorie sélectionnée — et pilotée depuis le
 * contrôleur. Chaque champ part de sa liste fermée de tranches (`PRICE_BUCKETS` /
 * `MOQ_BUCKETS`) enrichie des **compteurs** issus de la distribution de facettes
 * du moteur (`facetDistribution` sur `priceMin` / `moq`, agrégée par tranche avec
 * `sumRangeCount`).
 *
 * Moteur de recherche indisponible : les tranches sont renvoyées sans compteur
 * (`hasCounts: false`, `count: null`), l'UI les affiche toutes.
 */
@inject()
export default class CatalogueNumericFacetService {
  constructor(private engine: SearchEngine) {}

  async forCatalogue(filters: ProductDirectoryFilters): Promise<CatalogueNumericFacetsType> {
    if (!this.engine.enabled) {
      return { price: this.withoutCounts(PRICE_BUCKETS), moq: this.withoutCounts(MOQ_BUCKETS) }
    }

    const query = filters.search?.trim() || ''
    try {
      // Deux distributions : chaque champ s'exclut de son propre cadrage (ses
      // tranches cochées gardent un compteur, les autres restent non nulles), mais
      // reste cadré par l'autre champ et par les filtres de navigation.
      const [priceDistribution, moqDistribution] = await Promise.all([
        this.engine.facetDistribution({
          query,
          filter: this.scopingFilter(filters, 'price'),
          facets: [PRICE_FACET_FIELD],
        }),
        this.engine.facetDistribution({
          query,
          filter: this.scopingFilter(filters, 'moq'),
          facets: [MOQ_FACET_FIELD],
        }),
      ])
      return {
        price: this.withCounts(PRICE_BUCKETS, priceDistribution[PRICE_FACET_FIELD] ?? {}),
        moq: this.withCounts(MOQ_BUCKETS, moqDistribution[MOQ_FACET_FIELD] ?? {}),
      }
    } catch (error) {
      logger.warn(
        { err: error },
        'numeric facet distribution unavailable, serving buckets without counts'
      )
      return { price: this.withoutCounts(PRICE_BUCKETS), moq: this.withoutCounts(MOQ_BUCKETS) }
    }
  }

  private withCounts(
    buckets: readonly NumericBucket[],
    counts: Record<string, number>
  ): NumericFacetBarType {
    return {
      buckets: buckets.map((bucket, index) => ({
        index,
        minValue: bucket.minValue,
        maxValue: bucket.maxValue,
        count: sumRangeCount(counts, bucket.minValue, bucket.maxValue),
      })),
      hasCounts: true,
    }
  }

  private withoutCounts(buckets: readonly NumericBucket[]): NumericFacetBarType {
    return {
      buckets: buckets.map((bucket, index) => ({
        index,
        minValue: bucket.minValue,
        maxValue: bucket.maxValue,
        count: null,
      })),
      hasCounts: false,
    }
  }

  /**
   * Cadrage de la distribution d'un champ : tous les autres critères de navigation
   * (catégorie, terme, provenance, stock, certifications, nouveautés, éco, tranches
   * EAV) **plus** les tranches de l'autre champ numérique, **sans** les tranches du
   * champ compté — même raisonnement que la barre certifications.
   */
  private scopingFilter(
    filters: ProductDirectoryFilters,
    counting: CountingField
  ): ProductSearchFilter {
    const threshold = filters.newOnly
      ? DateTime.now().minus({ days: NEW_PRODUCT_WINDOW_DAYS }).startOf('day')
      : null
    return {
      categoryId: filters.categoryId,
      madeInEurope: filters.madeInEurope,
      attributeValueIds: filters.attributeValueIds,
      certificationIds: filters.certificationIds,
      originZones: filters.originZones,
      stockStatuses: filters.stockStatuses,
      releasedAfter: threshold ? Math.trunc(threshold.toSeconds()) : null,
      isEco: filters.ecoOnly,
      attributeRanges: attributeSelectionsToFilters(filters.attributeRanges),
      priceRanges: counting === 'price' ? [] : bucketsToRanges(filters.priceBuckets, PRICE_BUCKETS),
      moqRanges: counting === 'moq' ? [] : bucketsToRanges(filters.moqBuckets, MOQ_BUCKETS),
    }
  }
}
