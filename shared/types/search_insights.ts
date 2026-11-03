import type { DateTime } from 'luxon'
import type { OrganizationKind } from './organization.js'
import type { SearchEventMode, SearchEventSource } from './search_event.js'

/**
 * Écran admin « Ce que cherchent les clients » (#173) : agrégations des
 * journaux `search_events` (#171) et `activity_events` (#172).
 */

/** Période par défaut quand `from` / `to` sont absents. */
export const SEARCH_INSIGHTS_DEFAULT_DAYS = 30

/** Période maximale analysable en une requête (borne le coût des agrégations). */
export const SEARCH_INSIGHTS_MAX_DAYS = 366

/** Nombre de lignes des classements (top requêtes, sans résultat, filtres…). */
export const SEARCH_INSIGHTS_TOP_LIMIT = 20

/** Filtres de l'écran (query string). `from` / `to` : jours ISO `AAAA-MM-JJ`, inclus. */
export type SearchInsightsFilters = {
  from: string
  to: string
  source: SearchEventSource | null
  /** Langue de l'interface au moment de la recherche. */
  locale: string | null
  /** Type de l'organisation de l'auteur (les recherches anonymisées en sont exclues si filtré). */
  organizationType: OrganizationKind | null
}

/** Bornes (UTC) d'une période, incluses. */
export type SearchInsightsRange = {
  from: DateTime
  to: DateTime
}

export type SearchInsightsSummary = {
  total: number
  zeroResults: number
  /** `zeroResults / total` entre 0 et 1 ; 0 quand `total` vaut 0. */
  zeroRate: number
  /** Nombre de recherches par mode (tous les modes sont présents, éventuellement à 0). */
  byMode: Record<SearchEventMode, number>
  /** Total de la période précédente de même durée, pour la comparaison. */
  previousTotal: number
}

export type SearchInsightsQueryRow = {
  query: string
  count: number
  zeroCount: number
  /** Moyenne des résultats renvoyés, arrondie à l'entier. */
  avgResults: number
}

export type SearchInsightsDayPoint = {
  /** `AAAA-MM-JJ` */
  date: string
  total: number
  zeroResults: number
}

export type SearchInsightsCategoryRow = {
  categoryId: number
  /** Nom traduit dans la langue de l'admin (repli géré par `resolveTranslation`). */
  name: string
  count: number
}

export type SearchInsightsFilterRow = {
  /** Clé de filtre (ex. `minPrice`, `attr_color`, `certification`). */
  key: string
  count: number
}

/** Cible consultée ou ajoutée à une demande de devis. */
export type SearchInsightsTargetRow = {
  targetId: number
  name: string
  views: number
  /** Ajouts à une RFQ (produits uniquement ; 0 pour les fournisseurs). */
  rfqAdds: number
}

export type SearchInsightsReport = {
  filters: SearchInsightsFilters
  summary: SearchInsightsSummary
  topQueries: SearchInsightsQueryRow[]
  zeroResultQueries: SearchInsightsQueryRow[]
  daily: SearchInsightsDayPoint[]
  topCategories: SearchInsightsCategoryRow[]
  topFilters: SearchInsightsFilterRow[]
  topProducts: SearchInsightsTargetRow[]
  topSuppliers: SearchInsightsTargetRow[]
}
