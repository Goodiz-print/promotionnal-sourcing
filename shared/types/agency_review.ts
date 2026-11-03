import type { AdminActionContext, AdminActor } from '#shared/types/admin_audit'
import type { AgencyReviewReason } from '#shared/types/agency_signup'

/**
 * File de revue des inscriptions agence (#162). Types exposés en props Inertia :
 * des `type`, pas des `interface` (cf. `admin_demand.ts`).
 */

/** Décisions d'un opérateur sur une inscription agence à revoir. */
export const AGENCY_REVIEW_DECISIONS = ['approved', 'rejected', 'info_requested'] as const

export type AgencyReviewDecision = (typeof AGENCY_REVIEW_DECISIONS)[number]

/** Décisions qui exigent un motif (message à l'agence pour une demande d'informations). */
export const AGENCY_REVIEW_REASON_REQUIRED: readonly AgencyReviewDecision[] = [
  'rejected',
  'info_requested',
]

/** Statut courant : la dernière décision, ou `pending` si l'agence n'en a aucune. */
export type AgencyReviewStatus = 'pending' | AgencyReviewDecision

/**
 * Filtre de la file : `open` (par défaut) = agences encore à revoir (en attente ou
 * informations demandées) ; `approved` / `rejected` = historique des décisions.
 */
export const AGENCY_REVIEW_FILTERS = ['open', 'approved', 'rejected'] as const

export type AgencyReviewFilter = (typeof AGENCY_REVIEW_FILTERS)[number]

export type AdminAgencyReviewFilters = {
  status: AgencyReviewFilter
}

/** Ligne de la file. */
export type AdminAgencyReviewItem = {
  id: number
  name: string
  country: string
  email: string | null
  website: string | null
  reasons: AgencyReviewReason[]
  /** Date du contrôle VIES réussi, `null` si la TVA n'est pas vérifiée. */
  vatVerifiedAt: string | null
  /** Date de la vérification du domaine de l'email, `null` sinon. */
  domainVerifiedAt: string | null
  status: AgencyReviewStatus
  submittedAt: string
}

export type AdminAgencyReviewHistoryItem = {
  id: number
  decision: AgencyReviewDecision
  reason: string | null
  /** Motifs de revue au moment de la décision. */
  reasons: AgencyReviewReason[]
  decidedByEmail: string | null
  decidedAt: string
}

export type AdminAgencyReviewOwner = {
  email: string
  fullName: string | null
}

export type AdminAgencyReviewDetail = {
  item: AdminAgencyReviewItem
  phone: string | null
  siret: string | null
  vatNumber: string | null
  /** Activité déclarée (`activityOther` si « autre »). */
  activity: string | null
  owners: AdminAgencyReviewOwner[]
  history: AdminAgencyReviewHistoryItem[]
  /** Faux une fois la revue terminée (approuvée, rejetée) : plus de décision possible. */
  canDecide: boolean
}

/** Options de la liste paginée de la file. */
export type AgencyReviewListOptions = AdminAgencyReviewFilters & {
  page: number
  perPage: number
}

/** Décision à enregistrer : l'agence, la décision, son motif et son auteur. */
export type AgencyReviewDecideOptions = {
  organizationId: number
  decision: AgencyReviewDecision
  reason: string | null
  decidedBy: AdminActor
  context: AdminActionContext
}

/** Ligne SQL de la file (colonnes de `organizations` + dernière décision). */
export type AgencyReviewQueueRow = {
  id: number
  name: string
  country: string
  email: string | null
  website: string | null
  review_reasons: AgencyReviewReason[]
  vat_verified_at: Date | null
  domain_verified_at: Date | null
  created_at: Date
  decision: AgencyReviewDecision | null
}
