import type { ContentLocale, Locale } from './i18n.js'
import type { ProductType } from './product.js'
import type { SupplierProfileType } from './organization.js'
import type { OrganizationDocumentType } from './document.js'

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
  documents: OrganizationDocumentType[]
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
  translations: Partial<Record<ContentLocale, { name: string; description?: string | null }>>
}

export interface UpdateSupplierData extends Partial<CreateSupplierData> {}

/** Contact commercial affiché sur la page fournisseur (visible des agences validées). */
export type SupplierContactType = {
  id: number
  organizationId: number
  name: string
  jobTitle: string | null
  email: string
  phone: string | null
  languages: string[]
  coverage: string | null
  position: number
}

/** Actualité publiée sur la page fournisseur (nouveautés de l'accueil). */
export type SupplierNewsType = {
  id: number
  organizationId: number
  title: string
  body: string
  publishedAt: string
}

/** Salon où le fournisseur est présent. */
export type SupplierTradeShowType = {
  id: number
  organizationId: number
  name: string
  year: number
  booth: string | null
}

/** Adresse de facturation et références (abonnement payant). */
export type BillingProfileType = {
  id: number
  organizationId: number
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  postalCode: string | null
  country: string | null
  email: string | null
  purchaseOrderReference: string | null
}
