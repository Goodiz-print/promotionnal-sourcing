import type { AgencyReviewReason } from './agency_signup.js'
import type { OrganizationKind, OrganizationSize, SubscriptionPlan } from './organization.js'
import type { QuoteAddressSource } from './rfq.js'
import type { RoleSlug } from './role.js'
import type { PaidSubscriptionPlan, SubscriptionStatus } from './subscription.js'

/**
 * Gestion des organisations par la plateforme (#161).
 * Types exposés en props Inertia : des `type`, pas des `interface`.
 */

/** Filtres de la liste des organisations (query string, tous optionnels). */
export type AdminOrganizationIndexFilters = {
  /** Recherche partielle sur nom, slug, SIRET ou TVA (insensible à la casse). `null` = aucune. */
  search: string | null
  /** `null` = tous les types. */
  type: OrganizationKind | null
  /** `active`, `archived` ou `all`. */
  status: AdminOrganizationStatusFilter
  /** Code pays ISO 2 lettres. `null` = tous. */
  country: string | null
  /**
   * Seulement les organisations fournisseurs sans adresse de réception
   * explicite, qui se rabattent sur leurs membres responsables (#217).
   */
  missingQuoteAddress: boolean
}

export const ADMIN_ORGANIZATION_STATUS_FILTERS = ['active', 'archived', 'all'] as const

export type AdminOrganizationStatusFilter = (typeof ADMIN_ORGANIZATION_STATUS_FILTERS)[number]

/** Options de la liste organisations passees en props Inertia pour les filtres. */
export type AdminOrganizationFilterOptions = {
  organizationTypes: OrganizationKind[]
  countries: string[]
}

/** Ligne de la liste des organisations. */
export type AdminOrganizationListItem = {
  id: number
  name: string
  slug: string
  organizationType: OrganizationKind
  country: string
  membersCount: number
  archivedAt: string | null
  createdAt: string
  /** Derniere activite (derniere connexion d'un membre). */
  lastActivity: string | null
  /**
   * Adresse qui reçoit les demandes de devis (#217) ; `null` pour une
   * organisation qui n'est pas fournisseur.
   */
  quoteAddressSource: QuoteAddressSource | null
}

/** Membre d'une organisation (fiche organisation). */
export type AdminOrganizationMember = {
  id: number
  membershipId: number
  email: string
  fullName: string | null
  roleSlug: RoleSlug
  joinedAt: string
}

/** Invitation en attente (fiche organisation). */
export type AdminOrganizationInvitation = {
  id: number
  email: string
  roleSlug: RoleSlug
  expiresAt: string
  invitedByEmail: string | null
  invitedByName: string | null
}

/** Profil fournisseur (fiche organisation). */
export type AdminOrganizationSupplierProfile = {
  id: number
  /** Adresse de réception des demandes de devis (#217). */
  quoteEmail: string | null
  /** Confirmation de `quoteEmail` par lien ; `null` : pas encore confirmée, donc pas utilisée. */
  quoteEmailVerifiedAt: string | null
  minOrderQuantity: number | null
  deliveryDays: number | null
  deliveryScope: string | null
  certifications: string[] | null
  bio: string | null
  responseTimeDays: number | null
  companyType: string | null
  deliveryCountries: string[] | null
  spokenLanguages: string[] | null
  reportFrequency: string
  catalogueUpdateMode: string | null
  catalogueUpdateFrequency: string | null
  defaultOriginScope: string | null
  isFoundingPartner: boolean
  commercialStatus: string
  createdAt: string
  updatedAt: string | null
}

/** Profil agence (fiche organisation). */
export type AdminOrganizationAgencyProfile = {
  id: number
  activity: string
  activityOther: string | null
  teamSize: string | null
  purchaseVolume: string | null
  clientSectors: string[] | null
  defaultMarginPercent: string | null
  createdAt: string
  updatedAt: string | null
}

/** Profil de facturation (fiche organisation). */
export type AdminOrganizationBillingProfile = {
  id: number
  email: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  purchaseOrderReference: string | null
  /** stripeCustomerId omis : secret. */
  createdAt: string
  updatedAt: string | null
}

/** Fiche complete d'une organisation. */
export type AdminOrganizationDetail = AdminOrganizationListItem & {
  email: string | null
  phone: string | null
  website: string | null
  siret: string | null
  vatNumber: string | null
  industry: string | null
  size: OrganizationSize | null
  description: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  postalCode: string | null
  logoUrl: string | null
  subscriptionPlan: SubscriptionPlan
  /** Abonnements, du plus récent au plus ancien (#214) : le premier ouvert est l'abonnement en cours ou programmé. */
  subscriptions: AdminOrganizationSubscription[]
  locale: string
  updatedAt: string | null
  /** Agence: motifs de revue renseignes a l'inscription. */
  reviewReasons: AgencyReviewReason[] | null
  /** Agence: TVA verifiee automatiquement (VIES). */
  vatVerifiedAt: string | null
  /** Agence: domaine de l'email verifie automatiquement. */
  domainVerifiedAt: string | null
  productsCount: number
  rfqsCount: number
  members: AdminOrganizationMember[]
  pendingInvitations: AdminOrganizationInvitation[]
  supplierProfile: AdminOrganizationSupplierProfile | null
  agencyProfile: AdminOrganizationAgencyProfile | null
  billingProfile: AdminOrganizationBillingProfile | null
  /** Flags d'actions autorisees pour l'utilisateur courant. */
  canManage: boolean
}

/** Donnees de modification d'une organisation par l'admin. */
export type AdminOrganizationUpdateData = {
  name?: string
  email?: string | null
  phone?: string | null
  website?: string | null
  siret?: string | null
  vatNumber?: string | null
  industry?: string | null
  size?: OrganizationSize | null
  description?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string
}

/**
 * Période d'abonnement affichée dans la fiche admin (#214). `editable` : abonnement
 * manuel encore ouvert, que l'admin peut prolonger ou résilier.
 */
export type AdminOrganizationSubscription = {
  id: number
  plan: PaidSubscriptionPlan
  status: SubscriptionStatus
  origin: string
  startsAt: string
  /** Fin exclusive (début du jour qui suit le dernier jour couvert). */
  endsAt: string | null
  cancelledAt: string | null
  createdByEmail: string | null
  createdAt: string
  editable: boolean
}
