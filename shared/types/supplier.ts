import type { Locale } from './i18n.js'
import type { ProductType } from './product.js'
import type { SupplierProfileType } from './organization.js'

export interface SupplierTranslationType {
  locale: Locale
  name: string
  description: string | null
}

/**
 * Fiche fournisseur du catalogue, sérialisée pour le frontend (`name`/
 * `description` résolus dans la locale active). Déclaré en `type` (et non
 * `interface`) pour rester assignable aux props Inertia (`Record<string, JSONDataTypes>`).
 */
export type SupplierType = {
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

/**
 * Fiche fournisseur détaillée (annuaire public) : la fiche + son profil
 * fournisseur (si l'organisation est liée) + son catalogue produits.
 */
export type SupplierDetailType = SupplierType & {
  supplierProfile: SupplierProfileType | null
  products: ProductType[]
}

/**
 * Filtres de l'annuaire public.
 */
export type SupplierDirectoryFilters = {
  search: string | null
  country: string | null
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
