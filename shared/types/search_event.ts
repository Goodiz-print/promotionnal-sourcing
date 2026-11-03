/**
 * Journal des recherches des clients (#171). Chaque recherche significative est
 * enregistrée dans `search_events`, de façon asynchrone : ce que les clients
 * cherchent (et ne trouvent pas) ne se rattrape pas après coup.
 */

/** Écran d'où part la recherche (`catalogue_image` : catalogue, terme généré depuis une photo). */
export const SEARCH_EVENT_SOURCES = [
  'catalogue',
  'catalogue_image',
  'suppliers',
  'rfq_lookup',
] as const

export type SearchEventSource = (typeof SEARCH_EVENT_SOURCES)[number]

/**
 * Comment la recherche a été servie :
 * - `semantic` : mots-clés + vecteur de la requête ;
 * - `keyword` : mots-clés seuls (choix, ou repli quand l'API d'embeddings échoue) ;
 * - `unavailable` : moteur injoignable ou inerte, la page a affiché « recherche
 *   indisponible » ;
 * - `browse` : navigation par catégorie / filtres, sans terme.
 */
export const SEARCH_EVENT_MODES = ['semantic', 'keyword', 'unavailable', 'browse'] as const

export type SearchEventMode = (typeof SEARCH_EVENT_MODES)[number]

/** Valeurs des filtres actifs (hors terme et catégorie, qui ont leur colonne). */
export type SearchEventFilters = Record<string, unknown>

/** Charge utile d'un événement : sérialisable, elle voyage dans la queue. */
export interface SearchEventPayload {
  source: SearchEventSource
  /** Terme normalisé (minuscules, espaces compactés) ; `null` : navigation par filtres. */
  query: string | null
  filters: SearchEventFilters
  categoryId: number | null
  mode: SearchEventMode
  resultsCount: number
  userId: number | null
  organizationId: number | null
  locale: string
}

/**
 * Trace d'une recherche remplie par `ProductSearchService` : le mode réellement
 * utilisé n'est connu qu'à l'intérieur (repli sémantique → mots-clés).
 */
export interface SearchTrace {
  mode?: SearchEventMode
}

/** Longueur maximale d'un terme enregistré (au-delà : tronqué). */
export const SEARCH_EVENT_QUERY_MAX_LENGTH = 200

/** Deux recherches identiques d'un même utilisateur dans cette fenêtre n'en font qu'une. */
export const SEARCH_EVENT_DEDUPE_SECONDS = 30

/** RGPD : au-delà, l'événement n'est plus rattaché à un utilisateur. */
export const SEARCH_EVENT_PSEUDONYMISE_AFTER_DAYS = 90

/** RGPD : au-delà, l'événement est supprimé. */
export const SEARCH_EVENT_RETENTION_DAYS = 730
