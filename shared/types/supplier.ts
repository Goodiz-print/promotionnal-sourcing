import type { Locale } from './i18n.js'

export interface SupplierTranslationType {
  locale: Locale
  name: string
  description: string | null
}

export interface SupplierType {
  id: number
  name: string | null
  slug: string
  country: string
  website: string | null
  email: string | null
  phone: string | null
  description: string | null
  logoUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

export interface CreateSupplierData {
  slug: string
  country?: string
  website?: string | null
  email?: string | null
  phone?: string | null
  logoUrl?: string | null
  isActive?: boolean
  translations: Partial<Record<Locale, { name: string; description?: string | null }>>
}

export interface UpdateSupplierData extends Partial<CreateSupplierData> {}
