import type { SearchInsightsFilters } from '#shared/types/search_insights'

/**
 * Calculs d'affichage de l'écran « Ce que cherchent les clients » : taux,
 * variation et paramètres d'URL (visite et export CSV partagent les mêmes).
 */

/** Variation en % arrondi du total vs la période précédente ; `null` sans base de comparaison. */
export function variationPercent(total: number, previousTotal: number): number | null {
  if (previousTotal <= 0) return null
  return Math.round(((total - previousTotal) / previousTotal) * 100)
}

/** Paramètres de query string : les filtres vides sont omis. */
export function searchParams(filters: SearchInsightsFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.source) params.source = filters.source
  if (filters.locale) params.locale = filters.locale
  if (filters.organizationType) params.organizationType = filters.organizationType
  return params
}

/** Ajoute la query string des filtres à une URL (export CSV). */
export function withSearchParams(url: string, filters: SearchInsightsFilters): string {
  const query = new URLSearchParams(searchParams(filters)).toString()
  return query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url
}

/** Nom d'une langue dans sa propre langue (« Deutsch », « Français »…). */
export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}
