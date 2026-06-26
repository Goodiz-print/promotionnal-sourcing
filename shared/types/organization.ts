import type { RoleType } from './role.js'

export type OrganizationSize = 'micro' | 'small' | 'medium' | 'large' | 'enterprise'

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
