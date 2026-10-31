/** Surfaces qui lancent une recherche enregistrée dans `search_events`. */
export const SEARCH_EVENT_SOURCES = ['catalogue', 'suppliers', 'rfq_lookup'] as const
export type SearchEventSource = (typeof SEARCH_EVENT_SOURCES)[number]

/**
 * Comment la requête a été servie :
 * - `semantic` : mots-clés + vecteurs (embedder actif) ;
 * - `keywords` : mots-clés seuls ;
 * - `unavailable` : moteur indisponible, aucun résultat n'a pu être servi ;
 * - `directory` : navigation par filtres ou annuaire, servie par PostgreSQL.
 */
export const SEARCH_EVENT_MODES = ['semantic', 'keywords', 'unavailable', 'directory'] as const
export type SearchEventMode = (typeof SEARCH_EVENT_MODES)[number]

/** Longueur maximale d'un terme conservé (le reste est tronqué). */
export const SEARCH_EVENT_TERM_MAX_LENGTH = 255

/** Au-delà, le rattachement à l'utilisateur et à l'organisation est supprimé (RGPD). */
export const SEARCH_EVENT_PSEUDONYMIZE_AFTER_DAYS = 90

/** Au-delà, l'événement est supprimé. */
export const SEARCH_EVENT_RETENTION_DAYS = 365

/** Filtres actifs d'une recherche, tels que consignés (clés absentes = non utilisées). */
export type SearchEventFilters = Record<string, string | number | boolean | number[] | string[]>

/** Ce que les surfaces de recherche transmettent à `SearchEventService.record`. */
export interface SearchEventInput {
  source: SearchEventSource
  term: string | null
  filters: SearchEventFilters
  categoryId: number | null
  mode: SearchEventMode
  resultsCount: number
  userId: number | null
  organizationId: number | null
  locale: string
}

/** Payload du job d'écriture : l'entrée, plus la date de la recherche. */
export interface SearchEventPayload extends SearchEventInput {
  searchedAt: string
}

/** Lignes supprimées / pseudonymisées par une purge. */
export interface SearchEventPurgeResult {
  pseudonymized: number
  deleted: number
}
