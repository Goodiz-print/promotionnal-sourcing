import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import CatalogueFacetsService from '#services/catalogue_facets_service'
import SearchEngine from '#services/search/search_engine'
import { facetField, type FacetDistribution } from '#shared/types/search'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import type { CategoryAttributeType } from '#shared/types/category'
import type {
  CategoryFacetBarType,
  CategoryFacetRangeType,
  CategoryFacetType,
  CategoryFacetValueType,
} from '#shared/types/category'

/** Filtres de navigation qui cadrent la distribution de facettes d'une catégorie. */
export interface FacetBarContext {
  /** Terme de recherche : la distribution porte alors sur les résultats trouvés. */
  search?: string | null
  madeInEurope?: boolean
}

/**
 * Barre de filtres **dépendante de la catégorie** (2e PR du modèle produit,
 * `docs/search.md`) : les attributs filtrables résolus de la catégorie
 * (`CatalogueFacetsService.resolveFilters`, propres + hérités) enrichis des
 * **compteurs** issus des distributions de facettes du moteur (`facetDistribution`
 * sur les champs `attributes.<slug>`).
 *
 * Sans catégorie sélectionnée, la barre d'attributs est vide (le reste —
 * recherche, catégorie, made-in-Europe — vit dans le contrôleur). Moteur de
 * recherche indisponible : les attributs sont renvoyés sans compteur
 * (`hasCounts: false`, `count: null`), l'UI les affiche tous.
 */
@inject()
export default class CatalogueFacetBarService {
  constructor(
    private facets: CatalogueFacetsService,
    private engine: SearchEngine
  ) {}

  async forCategory(
    categoryId: number | null,
    locale: Locale = DEFAULT_LOCALE,
    context: FacetBarContext = {}
  ): Promise<CategoryFacetBarType> {
    if (categoryId === null) return { attributes: [], hasCounts: false }

    const attributes = await this.facets.resolveFilters(categoryId, locale)
    if (attributes.length === 0) return { attributes: [], hasCounts: false }

    const { distribution, hasCounts } = await this.distributionFor(categoryId, attributes, context)

    return {
      attributes: attributes.map((attribute) =>
        this.withCounts(attribute, distribution, hasCounts)
      ),
      hasCounts,
    }
  }

  /**
   * Compteurs par valeur depuis le moteur, pour les attributs résolus. La
   * distribution est cadrée par la catégorie (+ terme de recherche et
   * made-in-Europe), **sans** les valeurs de facette déjà cochées : un attribut
   * déjà filtré garde ainsi des compteurs non nuls sur ses autres valeurs.
   */
  private async distributionFor(
    categoryId: number,
    attributes: CategoryAttributeType[],
    context: FacetBarContext
  ): Promise<{ distribution: FacetDistribution; hasCounts: boolean }> {
    if (!this.engine.enabled) return { distribution: {}, hasCounts: false }

    try {
      const distribution = await this.engine.facetDistribution({
        query: context.search?.trim() || '',
        filter: { categoryId, madeInEurope: context.madeInEurope },
        facets: attributes.map((attribute) => facetField(attribute.slug)),
      })
      return { distribution, hasCounts: true }
    } catch (error) {
      logger.warn({ err: error }, 'facet distribution unavailable, serving filters without counts')
      return { distribution: {}, hasCounts: false }
    }
  }

  private withCounts(
    attribute: CategoryAttributeType,
    distribution: FacetDistribution,
    hasCounts: boolean
  ): CategoryFacetType {
    const counts = distribution[facetField(attribute.slug)] ?? {}

    const values: CategoryFacetValueType[] = attribute.values.map((value) => ({
      ...value,
      count: hasCounts ? (counts[String(value.id)] ?? 0) : null,
    }))

    const ranges: CategoryFacetRangeType[] = attribute.ranges.map((range) => ({
      ...range,
      count: hasCounts ? this.rangeCount(counts, range.minValue, range.maxValue) : null,
    }))

    return {
      attributeId: attribute.attributeId,
      slug: attribute.slug,
      name: attribute.name,
      type: attribute.type,
      unit: attribute.unit,
      position: attribute.position,
      values,
      ranges,
    }
  }

  /**
   * Compteur d'une tranche numérique : somme des valeurs de la distribution
   * comprises dans `[min, max[` (borne basse incluse, borne haute exclue — pas
   * de double comptage aux limites ; une borne `null` est ouverte).
   */
  private rangeCount(
    counts: Record<string, number>,
    minValue: number | null,
    maxValue: number | null
  ): number {
    let total = 0
    for (const [key, count] of Object.entries(counts)) {
      const value = Number(key)
      if (!Number.isFinite(value)) continue
      if (minValue !== null && value < minValue) continue
      if (maxValue !== null && value >= maxValue) continue
      total += count
    }
    return total
  }
}
