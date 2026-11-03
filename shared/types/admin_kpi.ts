import type { OrganizationKind } from '#shared/types/organization'
import type { ProductLifecycleStatus } from '#shared/types/product'
import type { RfqStatus } from '#shared/types/rfq'

/**
 * Tableau de bord KPI du back-office (#174). Les types exposés en props Inertia
 * sont des `type` (et non des `interface`) : cf. `admin_demand.ts`.
 */

/** Période par défaut de l'écran, en jours. */
export const ADMIN_KPI_DEFAULT_DAYS = 30

/** Durée maximale d'une période, en jours (borne le coût des agrégations). */
export const ADMIN_KPI_MAX_DAYS = 366

/**
 * Période affichée et période précédente de même durée, juste avant (dates
 * `AAAA-MM-JJ`, bornes incluses).
 */
export type AdminKpiPeriod = {
  from: string
  to: string
  previousFrom: string
  previousTo: string
}

/** Filtres de l'écran : la période demandée (la précédente en est déduite). */
export type AdminKpiFilters = {
  from: string
  to: string
}

/**
 * Valeur d'un indicateur sur la période et sur la précédente. `null` = non
 * défini (ratio dont le dénominateur est nul, durée sans événement).
 */
export type KpiMetric = {
  current: number | null
  previous: number | null
}

export type KpiAmount = {
  currency: string
  current: number
  previous: number
}

export type KpiAccounts = {
  newOrganizations: KpiMetric
  newUsers: KpiMetric
  /** Utilisateurs dont la dernière connexion tombe dans la période. */
  activeUsers: KpiMetric
  /** Nouvelles organisations de la période par type. */
  organizationsByType: { type: OrganizationKind; count: number }[]
}

export type KpiRfqs = {
  created: KpiMetric
  published: KpiMetric
  /** Délai moyen entre la création et la publication, en heures. */
  publicationDelayHours: KpiMetric
  /** Part des fournisseurs notifiés qui ont répondu, de 0 à 1. */
  supplierResponseRate: KpiMetric
  /** Part des fournisseurs notifiés qui ont décliné, de 0 à 1. */
  supplierDeclineRate: KpiMetric
  /** Demandes créées dans la période, par statut actuel. */
  byStatus: { status: RfqStatus; count: number }[]
}

export type KpiQuotes = {
  submitted: KpiMetric
  accepted: KpiMetric
  rejected: KpiMetric
  /** Délai moyen entre la remise et la décision de l'acheteur, en heures. */
  decisionDelayHours: KpiMetric
}

export type KpiOrders = {
  created: KpiMetric
  /** Part des devis remis dans la période qui ont donné une commande, de 0 à 1. */
  quoteToOrderRate: KpiMetric
  /** Délai moyen entre la création et la livraison, en heures. */
  deliveryDelayHours: KpiMetric
  /** Volume d'affaires (commandes non annulées) par devise. */
  gmv: KpiAmount[]
}

export type KpiCatalogue = {
  products: number
  byLifecycle: { status: ProductLifecycleStatus; count: number }[]
  /** Part des produits qui ont une traduction dans la langue, de 0 à 1. */
  translationCoverage: { locale: string; rate: number }[]
}

/** Éléments qui attendent une action d'un opérateur. */
export type KpiToHandle = {
  /** Agences non archivées avec au moins un motif de revue. */
  agencyReviews: number
}

export type KpiDailyRow = {
  /** Jour, `AAAA-MM-JJ`. */
  day: string
  organizations: number
  users: number
  rfqs: number
  quotes: number
  orders: number
}

export type AdminKpiReport = {
  period: AdminKpiPeriod
  accounts: KpiAccounts
  rfqs: KpiRfqs
  quotes: KpiQuotes
  orders: KpiOrders
  catalogue: KpiCatalogue
  toHandle: KpiToHandle
  daily: KpiDailyRow[]
}
