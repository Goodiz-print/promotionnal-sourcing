import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import SearchEngine from '#services/search/search_engine'
import { newProductThreshold } from '#services/new_product_window'
import {
  MOQ_BUCKETS,
  PRICE_BUCKETS,
  type CatalogueNumericFacetsType,
  type NumericBucket,
  type NumericFacetBarType,
  type ProductDirectoryFilters,
} from '#shared/types/product'
import {
  MOQ_FACET_FIELD,
  PRICE_FACET_FIELD,
  type FacetDistribution,
  type ProductSearchFilter,
} from '#shared/types/search'
import {
  attributeSelectionsToFilters,
  bucketsToRanges,
  sumRangeCount,
} from '#shared/helpers/numeric_ranges'

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
      return { price: this.bars(PRICE_BUCKETS, null), moq: this.bars(MOQ_BUCKETS, null) }
    }

    const query = filters.search?.trim() || ''
    try {
      // Tant qu'aucune tranche numérique n'est cochée, le cadrage des deux champs
      // est identique → **un seul** appel (`facets: [priceMin, moq]`). Dès qu'un
      // champ est filtré, chaque distribution doit s'exclure elle-même mais garder
      // l'autre → deux appels distincts (en parallèle).
      if (filters.priceBuckets.length === 0 && filters.moqBuckets.length === 0) {
        const distribution = await this.engine.facetDistribution({
          query,
          filter: this.scopingFilter(filters, 'price'),
          facets: [PRICE_FACET_FIELD, MOQ_FACET_FIELD],
        })
        return this.fromDistributions(distribution, distribution)
      }

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
      return this.fromDistributions(priceDistribution, moqDistribution)
    } catch (error) {
      logger.warn(
        { err: error },
        'numeric facet distribution unavailable, serving buckets without counts'
      )
      return { price: this.bars(PRICE_BUCKETS, null), moq: this.bars(MOQ_BUCKETS, null) }
    }
  }

  private fromDistributions(
    priceDistribution: FacetDistribution,
    moqDistribution: FacetDistribution
  ): CatalogueNumericFacetsType {
    return {
      price: this.bars(PRICE_BUCKETS, priceDistribution[PRICE_FACET_FIELD] ?? {}),
      moq: this.bars(MOQ_BUCKETS, moqDistribution[MOQ_FACET_FIELD] ?? {}),
    }
  }

  /**
   * Tranches prêtes pour l'UI. `counts` = distribution du champ → compteur par
   * tranche (`sumRangeCount`) et `hasCounts: true` ; `null` (moteur indisponible)
   * → tranches sans compteur.
   */
  private bars(
    buckets: readonly NumericBucket[],
    counts: Record<string, number> | null
  ): NumericFacetBarType {
    return {
      buckets: buckets.map((bucket, index) => ({
        index,
        minValue: bucket.minValue,
        maxValue: bucket.maxValue,
        count: counts ? sumRangeCount(counts, bucket.minValue, bucket.maxValue) : null,
      })),
      hasCounts: counts !== null,
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
    counting: 'price' | 'moq'
  ): ProductSearchFilter {
    const threshold = newProductThreshold(filters.newOnly)
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
