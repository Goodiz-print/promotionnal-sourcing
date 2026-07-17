import type { RoleType } from './role.js'

export const ORGANIZATION_SIZES = ['micro', 'small', 'medium', 'large', 'enterprise'] as const

export type OrganizationSize = (typeof ORGANIZATION_SIZES)[number]

/**
 * Type d'organisation : acheteur, fournisseur, ou les deux.
 * Le premier élément est la valeur par défaut (colonne `organization_type`).
 */
export const ORGANIZATION_TYPES = ['buyer', 'supplier', 'both'] as const

export type OrganizationKind = (typeof ORGANIZATION_TYPES)[number]

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
 * Périmètre de livraison d'un fournisseur.
 */
export const DELIVERY_SCOPES = ['national', 'europe', 'worldwide'] as const

export type DeliveryScope = (typeof DELIVERY_SCOPES)[number]

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
  createdAt: string
  updatedAt: string | null
}

export interface UpdateSupplierProfileData {
  minOrderQuantity?: number | null
  deliveryDays?: number | null
  deliveryScope?: DeliveryScope | null
  certifications?: string[] | null
  bio?: string | null
  responseTimeDays?: number | null
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
 * dédiées du service — upload/suppression Cloudinary, pas une URL saisie).
 */
export type UpdateOrganizationSettingsData = Omit<UpdateOrganizationData, 'slug' | 'logoUrl'>

export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked'] as const

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
