import { SEARCH_EVENT_TERM_MAX_LENGTH, type SearchEventFilters } from '#shared/types/search_event'

/** Terme normalisé pour l'agrégation : espaces écrasés, minuscules, tronqué. `null` si vide. */
export function normalizeSearchTerm(raw: string | null | undefined): string | null {
  const term = (raw ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  return term ? term.slice(0, SEARCH_EVENT_TERM_MAX_LENGTH) : null
}

/** Retire les filtres inactifs (faux, vides, nuls) : ne reste que ce que l'utilisateur a choisi. */
export function compactSearchFilters(
  filters: Record<string, string | number | boolean | number[] | string[] | null | undefined>
): SearchEventFilters {
  const active: SearchEventFilters = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === false || value === '') continue
    if (Array.isArray(value) && value.length === 0) continue
    active[key] = value
  }
  return active
}
