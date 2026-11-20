import type { RoleType } from './role.js'

export const ORGANIZATION_SIZES = ['micro', 'small', 'medium', 'large', 'enterprise'] as const

export type OrganizationSize = (typeof ORGANIZATION_SIZES)[number]

/**
 * Type d'organisation : acheteur, fournisseur, ou les deux.
 * Le premier élément est la valeur par défaut (colonne `organization_type`).
 */
export const ORGANIZATION_TYPES = ['buyer', 'supplier', 'both'] as const

export type OrganizationKind = (typeof ORGANIZATION_TYPES)[number]

/** Types d'organisation qui vendent, et reçoivent donc des demandes de devis. */
export const SUPPLIER_ORGANIZATION_KINDS: readonly OrganizationKind[] = ['supplier', 'both']

export const DEFAULT_ORGANIZATION_KIND: OrganizationKind = 'buyer'

/**
 * Types proposés à l'onboarding (l'utilisateur choisit acheteur ou fournisseur ;
 * `both` reste réglable plus tard côté organisation).
 */
export const ONBOARDING_TYPES = ['buyer', 'supplier'] as const

export type OnboardingKind = (typeof ONBOARDING_TYPES)[number]

export interface OnboardingData {
  name: string
  organizationType: OnboardingKind
}

/**
 * Options de création d'une organisation : transaction de l'appelant et colonnes
 * à poser dès la création (coordonnées, vérifications…). Les colonnes sont
 * typées en `Record` pour ne pas importer le modèle depuis `shared/`.
 */
export interface CreateOrganizationOptions {
  client?: import('@adonisjs/lucid/types/database').TransactionClientContract
  attributes?: Record<string, unknown>
}

/**
 * Périmètre de livraison d'un fournisseur.
 */
export const DELIVERY_SCOPES = ['national', 'europe', 'worldwide'] as const

export type DeliveryScope = (typeof DELIVERY_SCOPES)[number]

/**
 * Formule d'abonnement d'une organisation (fournisseur : gratuit · Business ·
 * Premium ; agence : gratuit · Premium). Le premier élément est la valeur par défaut.
 */
export const SUBSCRIPTION_PLANS = ['free', 'business', 'premium'] as const

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number]

/**
 * Statut commercial interne d'un fournisseur, dans l'ordre du parcours de
 * prospection (suivi par l'équipe, jamais montré au fournisseur).
 */
export const SUPPLIER_COMMERCIAL_STATUSES = [
  'prospect',
  'followed_up',
  'catalogue_received',
  'importing',
  'published',
  'suspended',
] as const

export type SupplierCommercialStatus = (typeof SUPPLIER_COMMERCIAL_STATUSES)[number]

/** Format sous lequel le fournisseur nous a envoyé son catalogue (pipeline d'import). */
export const CATALOGUE_SOURCE_FORMATS = ['excel', 'csv', 'xml', 'api', 'pdf_only'] as const

export type CatalogueSourceFormat = (typeof CATALOGUE_SOURCE_FORMATS)[number]

/** Nature de l'entreprise fournisseur. */
export const SUPPLIER_COMPANY_TYPES = ['manufacturer', 'importer_wholesaler', 'both'] as const

export type SupplierCompanyType = (typeof SUPPLIER_COMPANY_TYPES)[number]

/** Mode de mise à jour du catalogue souhaité par le fournisseur. */
export const CATALOGUE_UPDATE_MODES = ['managed', 'self_service', 'automatic'] as const

export type CatalogueUpdateMode = (typeof CATALOGUE_UPDATE_MODES)[number]

/**
 * Provenance par défaut déclarée par le fournisseur (écart 9), appliquée à son
 * catalogue à défaut d'origine saisie par produit. `per_product` = chaque fiche
 * porte sa propre origine.
 */
export const DEFAULT_ORIGIN_SCOPES = ['france', 'europe', 'outside_europe', 'per_product'] as const

export type DefaultOriginScope = (typeof DEFAULT_ORIGIN_SCOPES)[number]

export const CATALOGUE_UPDATE_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'on_demand'] as const

export type CatalogueUpdateFrequency = (typeof CATALOGUE_UPDATE_FREQUENCIES)[number]

/** Fréquence du rapport statistique envoyé par email au fournisseur. */
export const REPORT_FREQUENCIES = ['weekly', 'monthly', 'none'] as const

export type ReportFrequency = (typeof REPORT_FREQUENCIES)[number]

/**
 * DTO exposé aux pages Inertia. Défini en `type` (et non `interface`) pour
 * rester assignable à `Record<string, JSONDataTypes>` — contrainte de typage
 * des props Inertia (`inertia.render`). Une interface, sans signature d'index
 * implicite, y échouerait.
 */
export type OrganizationType = {
  id: number
  name: string
  slug: string
  siret: string | null
  vatNumber: string | null
  vatVerifiedAt: string | null
  locale: string
  subscriptionPlan: SubscriptionPlan
  email: string | null
  phone: string | null
  website: string | null
  industry: string | null
  size: OrganizationSize | null
  organizationType: OrganizationKind
  description: string | null
  logoUrl: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  postalCode: string | null
  country: string
  createdAt: string
  updatedAt: string | null
}

/**
 * DTO exposé aux pages Inertia. Défini en `type` (et non `interface`) pour
 * rester assignable à `Record<string, JSONDataTypes>` — contrainte de typage
 * des props Inertia (`inertia.render`). Une interface, sans signature d'index
 * implicite, y échouerait.
 */
export type SupplierProfileType = {
  id: number
  organizationId: number
  minOrderQuantity: number | null
  deliveryDays: number | null
  deliveryScope: DeliveryScope | null
  certifications: string[] | null
  bio: string | null
  responseTimeDays: number | null
  companyType: SupplierCompanyType | null
  deliveryCountries: string[] | null
  spokenLanguages: string[] | null
  minOrderNote: string | null
  quoteEmail: string | null
  reportFrequency: ReportFrequency
  catalogueUpdateMode: CatalogueUpdateMode | null
  catalogueUpdateFrequency: CatalogueUpdateFrequency | null
  defaultOriginScope: DefaultOriginScope | null
  isFoundingPartner: boolean
  foundingPartnerUntil: string | null
  createdAt: string
  updatedAt: string | null
}

/**
 * Champs que le **fournisseur** édite lui-même (étapes 2 à 4 du classeur de
 * collecte). Le suivi commercial interne (statut, notes, contact principal,
 * partenaire fondateur) est volontairement absent : il est réservé à l'équipe.
 */
export interface UpdateSupplierProfileData {
  minOrderQuantity?: number | null
  deliveryDays?: number | null
  deliveryScope?: DeliveryScope | null
  certifications?: string[] | null
  bio?: string | null
  responseTimeDays?: number | null
  companyType?: SupplierCompanyType | null
  deliveryCountries?: string[] | null
  spokenLanguages?: string[] | null
  minOrderNote?: string | null
  quoteEmail?: string | null
  reportFrequency?: ReportFrequency
  catalogueUpdateMode?: CatalogueUpdateMode | null
  catalogueUpdateFrequency?: CatalogueUpdateFrequency | null
  defaultOriginScope?: DefaultOriginScope | null
}

/**
 * Suivi commercial d'un fournisseur, saisi par l'équipe à la création du compte
 * depuis le fichier de prospection. Jamais exposé au fournisseur.
 */
export interface UpdateSupplierProspectingData {
  commercialStatus?: SupplierCommercialStatus
  primaryContactName?: string | null
  primaryContactEmail?: string | null
  isFoundingPartner?: boolean
  foundingPartnerUntil?: string | null
  catalogueSourceFormat?: CatalogueSourceFormat | null
  internalNotes?: string | null
}

/**
 * DTO exposé aux pages Inertia (liste des membres) — `type` requis, cf.
 * `OrganizationType` ci-dessus pour la justification.
 */
export type OrganizationMemberType = {
  id: number
  fullName: string | null
  email: string
  role: RoleType
  joinedAt: string
}

export interface CreateOrganizationData {
  name: string
  slug?: string
  siret?: string | null
  vatNumber?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  industry?: string | null
  size?: OrganizationSize | null
  description?: string | null
  logoUrl?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string
}

export interface UpdateOrganizationData extends Partial<CreateOrganizationData> {}

/**
 * Données du formulaire "paramètres généraux" : hors `slug` (non modifiable
 * dans cet écran) et hors `logoUrl` (le logo est géré par des méthodes
 * dédiées du service — upload/suppression Cellar, pas une URL saisie).
 */
export type UpdateOrganizationSettingsData = Omit<UpdateOrganizationData, 'slug' | 'logoUrl'>

/**
 * `expired` est posé par la purge planifiée (`PurgeExpiredInvitationsJob`), pas
 * par une action utilisateur : une invitation en attente dont `expires_at` est
 * dépassé n'est déjà plus acceptable côté contrôleur, ce statut ne fait que le
 * matérialiser en base.
 */
export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired'] as const

export type InvitationStatus = (typeof INVITATION_STATUSES)[number]

/**
 * DTO exposé aux pages Inertia (invitations en attente) — `type` requis,
 * cf. `OrganizationType` ci-dessus pour la justification.
 */
export type OrganizationInvitationType = {
  id: number
  email: string
  role: RoleType
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}

/**
 * Bilan d'une purge d'invitations (`OrganizationInvitationsService#purgeExpired`) :
 * `expired` = invitations en attente basculées en `expired`,
 * `deleted` = invitations en état terminal supprimées après rétention.
 */
export type PurgeInvitationsResult = {
  expired: number
  deleted: number
}

/**
 * Organisation résumée pour le sélecteur (prop partagée Inertia) : de quoi
 * l'identifier et savoir à quel titre l'utilisateur y appartient. Le sélecteur
 * n'est affiché qu'au-delà d'une organisation.
 */
export type OrganizationSummaryType = {
  id: number
  name: string
  slug: string
  logoUrl: string | null
  organizationType: OrganizationKind
  role: RoleType
}

export interface InviteMemberData {
  email: string
  roleId: number
}

/**
 * DTO exposé à l'écran public d'acceptation d'invitation.
 */
export type OrganizationInvitationPreviewType = {
  id: number
  organizationName: string
  roleName: string
  invitedByName: string | null
  email: string
}
