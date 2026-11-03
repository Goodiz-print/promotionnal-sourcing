import type { OrganizationKind } from '#shared/types/organization'
import type { SearchEventMode, SearchEventSource } from '#shared/types/search_event'

/**
 * Écran « Ce que cherchent les clients » (#173) : lecture agrégée de
 * `search_events` (#171) et `activity_events` (#172).
 */

/** Période par défaut de l'écran, en jours. */
export const ADMIN_DEMAND_DEFAULT_DAYS = 30

/** Nombre de lignes de chaque classement. */
export const ADMIN_DEMAND_TOP_LIMIT = 20

/** Filtres de l'écran. Dates au format `AAAA-MM-JJ`, bornes incluses. */
export interface AdminDemandFilters {
  from: string
  to: string
  source: SearchEventSource | null
  locale: string | null
  organizationType: OrganizationKind | null
}

export interface DemandSummary {
  searches: number
  zeroResultSearches: number
  /** Part des recherches sans résultat, de 0 à 1 ; `0` quand il n'y a aucune recherche. */
  zeroResultRate: number
  /** Part des recherches servies en mode sémantique, de 0 à 1. */
  semanticRate: number
}

export interface DemandQueryRow {
  query: string
  searches: number
  averageResults: number
  zeroResultSearches: number
}

export interface DemandTrendRow {
  /** Jour, `AAAA-MM-JJ`. */
  day: string
  searches: number
  zeroResultSearches: number
}

export interface DemandModeRow {
  mode: SearchEventMode
  searches: number
}

export interface DemandFilterRow {
  filter: string
  searches: number
}

export interface DemandCategoryRow {
  categoryId: number
  name: string
  searches: number
}

export interface DemandTargetRow {
  targetId: number
  name: string
  count: number
}

export interface AdminDemandReport {
  summary: DemandSummary
  topQueries: DemandQueryRow[]
  zeroResultQueries: DemandQueryRow[]
  trend: DemandTrendRow[]
  modes: DemandModeRow[]
  filters: DemandFilterRow[]
  categories: DemandCategoryRow[]
  viewedProducts: DemandTargetRow[]
  viewedSuppliers: DemandTargetRow[]
  rfqProducts: DemandTargetRow[]
}
