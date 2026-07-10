import type { RoleType } from './role.js'

export type OrganizationSize = 'micro' | 'small' | 'medium' | 'large' | 'enterprise'

/**
 * Type d'organisation : acheteur, fournisseur, ou les deux.
 * Le premier élément est la valeur par défaut (colonne `organization_type`).
 */
export const ORGANIZATION_TYPES = ['buyer', 'supplier', 'both'] as const

export type OrganizationKind = (typeof ORGANIZATION_TYPES)[number]

export const DEFAULT_ORGANIZATION_KIND: OrganizationKind = 'buyer'

/**
 * Périmètre de livraison d'un fournisseur.
 */
export const DELIVERY_SCOPES = ['national', 'europe', 'worldwide'] as const

export type DeliveryScope = (typeof DELIVERY_SCOPES)[number]

export interface OrganizationType {
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

export interface OrganizationMemberType {
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
