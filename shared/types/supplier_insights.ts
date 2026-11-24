import type { ActivityDateRange } from './activity_event.js'
import type { Paginated } from './pagination.js'
import type { RoleSlug } from './role.js'
import type { SubscriptionUpsellType } from './subscription.js'

/**
 * Espace fournisseur « Consultations » (#239) : ce que les agences regardent de
 * ses produits et de sa fiche. Compteurs pour tous, identité des agences pour
 * les abonnés seulement (règle unique `SubscriptionService.isSubscribed`).
 *
 * Les types exposés en props Inertia sont des `type`, pas des `interface`
 * (contrainte `Record<string, JSONDataTypes>` des props).
 */

/** Périodes proposées, en jours (aujourd'hui compris). */
export const SUPPLIER_INSIGHTS_PERIODS = [7, 30, 90, 365] as const
export type SupplierInsightsPeriod = (typeof SUPPLIER_INSIGHTS_PERIODS)[number]

export const SUPPLIER_INSIGHTS_DEFAULT_PERIOD: SupplierInsightsPeriod = 30

/** Produits par page du tableau des consultations. */
export const SUPPLIER_INSIGHTS_PER_PAGE = 50

/** Nombre maximal d'agences listées (les plus récentes d'abord). */
export const SUPPLIER_INSIGHTS_AGENCY_LIMIT = 100

/**
 * Rôles qui voient l'écran : ceux qui traitent déjà les demandes reçues
 * (`RFQ_RESPONDER_ROLES`), et voient donc déjà le nom des agences abonné.
 */
export const SUPPLIER_INSIGHTS_ROLES: readonly RoleSlug[] = ['owner', 'admin', 'manager']

/** Ce que l'écran demande au service. */
export interface SupplierInsightsQuery {
  period: SupplierInsightsPeriod
  page: number
  locale: string
  /** Fournisseur abonné : la liste des agences est lue et envoyée. Sinon, jamais lue. */
  revealAgencies: boolean
}

export type SupplierInsightsSummary = {
  /** Consultations des fiches produit. */
  productViews: number
  /** Consultations de la fiche fournisseur. */
  supplierViews: number
  /** Ajouts d'un produit à une demande de devis. */
  rfqAdditions: number
  /** Produits consultés au moins une fois. */
  viewedProducts: number
}

export type SupplierInsightsProductRow = {
  productId: number
  name: string
  views: number
  rfqAdditions: number
}

/** Agence ayant consulté (abonné seulement) : événements de moins de 90 jours. */
export type SupplierInsightsAgencyRow = {
  name: string
  /** Consultations (produits et fiche). */
  views: number
  /** Produits distincts consultés. */
  products: number
  /** Dernière consultation, ISO 8601. */
  lastViewedAt: string
}

export type SupplierInsightsReport = {
  range: ActivityDateRange
  summary: SupplierInsightsSummary
  products: Paginated<SupplierInsightsProductRow>
  /** `null` pour un fournisseur non abonné : aucune agence n'est envoyée. */
  agencies: SupplierInsightsAgencyRow[] | null
}

export type SupplierInsightsPageProps = {
  period: SupplierInsightsPeriod
  report: SupplierInsightsReport
  /** Encart d'abonnement (#222), pour un non abonné seulement. */
  upsell: SubscriptionUpsellType | null
}
