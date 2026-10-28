import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import Certification from '#models/certification'
import SearchEngine from '#services/search/search_engine'
import { newProductThreshold } from '#services/new_product_window'
import CertificationTransformer from '#transformers/certification_transformer'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { MOQ_BUCKETS, PRICE_BUCKETS, type ProductDirectoryFilters } from '#shared/types/product'
import {
  CERTIFICATION_FACET_FIELD,
  type FacetDistribution,
  type ProductSearchFilter,
} from '#shared/types/search'
import { attributeSelectionsToFilters, bucketsToRanges } from '#shared/helpers/numeric_ranges'
import type { CertificationFacetBarType, CertificationFacetType } from '#shared/types/certification'

/**
 * Barre de filtres **certifications** du catalogue (écart 4, ÉTAPE 6 —
 * finalisation Meilisearch).
 *
 * Contrairement aux attributs EAV (dépendants de la catégorie, assemblés par
 * `CatalogueFacetBarService`), les labels de conformité sont **transverses aux
 * catégories** : la barre est donc **globale** — disponible sans catégorie
 * sélectionnée — et pilotée depuis le contrôleur, pas par `forCategory`. Elle
 * part du référentiel fermé (`certifications`, ~29 labels) enrichi des
 * **compteurs** issus de la distribution de facettes du moteur
 * (`facetDistribution` sur le champ `certificationIds`).
 *
 * Moteur de recherche indisponible (inerte ou injoignable) : les labels sont
 * renvoyés sans compteur (`hasCounts: false`, `count: null`), l'UI les affiche
 * tous.
 */
@inject()
export default class CatalogueCertificationFacetService {
  constructor(private engine: SearchEngine) {}

  async forCatalogue(
    filters: ProductDirectoryFilters,
    locale: Locale = DEFAULT_LOCALE
  ): Promise<CertificationFacetBarType> {
    const certifications = await Certification.query().preload('translations').orderBy('slug')
    if (certifications.length === 0) return { certifications: [], hasCounts: false }

    const { distribution, hasCounts } = await this.distributionFor(filters)
    const counts = distribution[CERTIFICATION_FACET_FIELD] ?? {}

    return {
      certifications: certifications.map((certification) => {
        const label = new CertificationTransformer(certification, locale).toObject()
        return {
          id: label.id,
          slug: label.slug,
          name: label.name,
          domain: label.domain,
          count: hasCounts ? (counts[String(label.id)] ?? 0) : null,
        } satisfies CertificationFacetType
      }),
      hasCounts,
    }
  }

  /**
   * Compteurs par label depuis le moteur. La distribution est cadrée par les
   * autres filtres de navigation (catégorie, terme, made-in-Europe, provenance,
   * nouveautés, éco) **sans** les labels déjà cochés : un label coché garde ainsi
   * un compteur, et les autres restent non nuls (même raisonnement que la barre
   * d'attributs).
   */
  private async distributionFor(
    filters: ProductDirectoryFilters
  ): Promise<{ distribution: FacetDistribution; hasCounts: boolean }> {
    if (!this.engine.enabled) return { distribution: {}, hasCounts: false }

    try {
      const distribution = await this.engine.facetDistribution({
        query: filters.search?.trim() || '',
        filter: this.scopingFilter(filters),
        facets: [CERTIFICATION_FACET_FIELD],
      })
      return { distribution, hasCounts: true }
    } catch (error) {
      logger.warn(
        { err: error },
        'certification facet distribution unavailable, serving labels without counts'
      )
      return { distribution: {}, hasCounts: false }
    }
  }

  /** Filtre de cadrage de la distribution — tous les critères sauf `certificationIds`. */
  private scopingFilter(filters: ProductDirectoryFilters): ProductSearchFilter {
    const threshold = newProductThreshold(filters.newOnly)
    return {
      categoryId: filters.categoryId,
      madeInEurope: filters.madeInEurope,
      attributeValueIds: filters.attributeValueIds,
      originZones: filters.originZones,
      // Statut de stock (plan L98) : cadre aussi la distribution des labels.
      stockStatuses: filters.stockStatuses,
      // Tranches numériques (plan L125) : cadrent aussi la distribution des labels.
      priceRanges: bucketsToRanges(filters.priceBuckets, PRICE_BUCKETS),
      moqRanges: bucketsToRanges(filters.moqBuckets, MOQ_BUCKETS),
      attributeRanges: attributeSelectionsToFilters(filters.attributeRanges),
      releasedAfter: threshold ? Math.trunc(threshold.toSeconds()) : null,
      isEco: filters.ecoOnly,
    }
  }
}
