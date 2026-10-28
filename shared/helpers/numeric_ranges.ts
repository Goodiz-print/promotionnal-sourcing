import type { AttributeRangeSelectionType, NumericBucket } from '../types/product.js'
import type { AttributeRangeFilter, NumericRangeFilter } from '../types/search.js'

/**
 * Tranches numériques `[min, max[` (plan L125) : la **même** sémantique partout
 * (comptage par tranche, filtrage moteur et repli PostgreSQL) — borne basse
 * **incluse**, borne haute **exclue**, borne `null` **ouverte** —, factorisée ici
 * pour ne pas la réécrire (CLAUDE.md interdit la duplication).
 */

/** `value ∈ [minValue, maxValue[` ; une borne `null` est ouverte. */
export function rangeContains(
  value: number,
  minValue: number | null,
  maxValue: number | null
): boolean {
  if (!Number.isFinite(value)) return false
  if (minValue !== null && value < minValue) return false
  if (maxValue !== null && value >= maxValue) return false
  return true
}

/**
 * Compteur d'une tranche : somme des valeurs d'une distribution de facette
 * (`facetDistribution`, clés = valeurs numériques en chaîne) comprises dans
 * `[minValue, maxValue[`. Les clés non numériques sont ignorées.
 */
export function sumRangeCount(
  counts: Record<string, number>,
  minValue: number | null,
  maxValue: number | null
): number {
  let total = 0
  for (const [key, count] of Object.entries(counts)) {
    if (rangeContains(Number(key), minValue, maxValue)) total += count
  }
  return total
}

/**
 * Résout des **index** de buckets (liste fermée partagée `PRICE_BUCKETS` /
 * `MOQ_BUCKETS`) en intervalles de filtre, en ignorant tout index hors liste.
 */
export function bucketsToRanges(
  indices: readonly number[],
  buckets: readonly NumericBucket[]
): NumericRangeFilter[] {
  const ranges: NumericRangeFilter[] = []
  for (const index of indices) {
    const bucket = buckets[index]
    if (bucket) ranges.push({ min: bucket.minValue, max: bucket.maxValue })
  }
  return ranges
}

/** Convertit des sélections de tranches EAV (UI) en filtres d'intervalle (moteur). */
export function attributeSelectionsToFilters(
  selections: readonly AttributeRangeSelectionType[]
): AttributeRangeFilter[] {
  return selections.map((selection) => ({
    slug: selection.slug,
    min: selection.minValue,
    max: selection.maxValue,
  }))
}
