import type { ActivityTargetCount } from '#shared/types/activity_event'
import type { OrganizationKind } from '#shared/types/organization'
import type { SearchEventMode, SearchEventSource } from '#shared/types/search_event'

/**
 * Écran « Ce que cherchent les clients » (#173) : lecture agrégée de
 * `search_events` (#171) et `activity_events` (#172).
 */

/**
 * Les types exposés en props Inertia sont des `type`, pas des `interface` : la
 * contrainte `Record<string, JSONDataTypes>` des props refuse les interfaces
 * (pas de signature d'index implicite).
 */

/** Période par défaut de l'écran, en jours. */
export const ADMIN_DEMAND_DEFAULT_DAYS = 30

/** Nombre de lignes de chaque classement. */
/** Durée maximale d'une période, en jours (borne le coût des agrégations et de l'export). */
export const ADMIN_DEMAND_MAX_DAYS = 366

/** Nombre maximal de requêtes distinctes dans l'export CSV. */
export const ADMIN_DEMAND_EXPORT_LIMIT = 50_000

export const ADMIN_DEMAND_TOP_LIMIT = 20

/** Filtres de l'écran. Dates au format `AAAA-MM-JJ`, bornes incluses. */
export type AdminDemandFilters = {
  from: string
  to: string
  source: SearchEventSource | null
  locale: string | null
  organizationType: OrganizationKind | null
}

export type DemandSummary = {
  searches: number
  zeroResultSearches: number
  /** Part des recherches sans résultat, de 0 à 1 ; `0` quand il n'y a aucune recherche. */
  zeroResultRate: number
  /** Part des recherches servies en mode sémantique, de 0 à 1. */
  semanticRate: number
}

export type DemandQueryRow = {
  query: string
  searches: number
  averageResults: number
  zeroResultSearches: number
}

export type DemandTrendRow = {
  /** Jour, `AAAA-MM-JJ`. */
  day: string
  searches: number
  zeroResultSearches: number
}

export type DemandModeRow = {
  mode: SearchEventMode
  searches: number
}

export type DemandFilterRow = {
  filter: string
  searches: number
}

export type DemandCategoryRow = {
  categoryId: number
  name: string
  searches: number
}

export type DemandTargetRow = ActivityTargetCount & {
  name: string
}

export type AdminDemandReport = {
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
