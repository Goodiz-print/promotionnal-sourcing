import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import type Product from '#models/product'
import {
  MOQ_BUCKETS,
  PRICE_BUCKETS,
  type AttributeRangeSelectionType,
  type ProductDirectoryFilters,
} from '#shared/types/product'
import { bucketsToRanges } from '#shared/helpers/numeric_ranges'
import type { NumericRangeFilter } from '#shared/types/search'

type ProductQuery = ModelQueryBuilderContract<typeof Product>

/**
 * Applique en **SQL** les mêmes tranches `[min, max[` que le filtre du moteur
 * (plan L125) : prix (palier le plus bas, `price_min`), MOQ (`min_quantity`) et
 * attributs numériques EAV (`product_attributes.value_number`). Même sémantique —
 * borne basse incluse, haute exclue, borne `null` ouverte — et mêmes résultats
 * que `buildProductFilter`, pour le repli PostgreSQL (navigation sans terme) et la
 * revérification au rechargement d'une recherche.
 *
 * Partagé par `ProductCatalogueService.list` et `ProductSearchService.reload`
 * (CLAUDE.md interdit la duplication de cette logique).
 */
export function applyProductRangeFilters(
  query: ProductQuery,
  selection: Pick<ProductDirectoryFilters, 'priceBuckets' | 'moqBuckets' | 'attributeRanges'>
): void {
  applyColumnRanges(query, 'priceMin', bucketsToRanges(selection.priceBuckets, PRICE_BUCKETS))
  applyColumnRanges(query, 'minQuantity', bucketsToRanges(selection.moqBuckets, MOQ_BUCKETS))
  applyAttributeRanges(query, selection.attributeRanges)
}

/** Tranches sur une colonne numérique du produit : OU entre tranches, groupé en un bloc. */
function applyColumnRanges(
  query: ProductQuery,
  column: string,
  ranges: NumericRangeFilter[]
): void {
  if (ranges.length === 0) return
  query.where((group) => {
    for (const range of ranges) {
      if (range.min === null && range.max === null) continue
      group.orWhere((clause) => {
        if (range.min !== null) clause.where(column, '>=', range.min)
        if (range.max !== null) clause.where(column, '<', range.max)
      })
    }
  })
}

/**
 * Tranches d'attributs EAV : regroupées par slug (OU interne entre tranches d'un
 * même attribut, ET entre attributs). Un `whereHas` par slug sur la facette portée
 * (`value_number` dans l'intervalle) — chaque contrainte combinée en AND.
 */
function applyAttributeRanges(
  query: ProductQuery,
  selections: AttributeRangeSelectionType[]
): void {
  const bySlug = new Map<string, AttributeRangeSelectionType[]>()
  for (const selection of selections) {
    const list = bySlug.get(selection.slug) ?? []
    list.push(selection)
    bySlug.set(selection.slug, list)
  }

  for (const [slug, ranges] of bySlug) {
    query.whereHas('productAttributes', (pa) => {
      pa.whereHas('attribute', (attribute) => attribute.where('slug', slug))
      pa.where((group) => {
        for (const range of ranges) {
          if (range.minValue === null && range.maxValue === null) continue
          group.orWhere((clause) => {
            clause.whereNotNull('valueNumber')
            if (range.minValue !== null) clause.where('valueNumber', '>=', range.minValue)
            if (range.maxValue !== null) clause.where('valueNumber', '<', range.maxValue)
          })
        }
      })
    })
  }
}
