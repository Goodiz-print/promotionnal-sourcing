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

/**
 * Contact de l'équipe commerciale d'un fournisseur (#241). `countries` : pays
 * couverts (ISO alpha-2) ; vide = tous les pays. `userId` : membre du compte
 * fournisseur relié, `null` pour une simple fiche de contact.
 */
export type SupplierContactType = {
  id: number
  name: string
  jobTitle: string | null
  email: string
  phone: string | null
  languages: string[]
  countries: string[]
  position: number
  userId: number | null
}

/** Saisie d'un contact commercial par le fournisseur (création ou modification). */
export interface SupplierContactData {
  name: string
  jobTitle?: string | null
  email: string
  phone?: string | null
  languages?: string[]
  countries?: string[]
  userId?: number | null
}

/** Sens de déplacement d'un contact dans l'ordre d'affichage. */
export const SUPPLIER_CONTACT_MOVES = ['up', 'down'] as const
export type SupplierContactMove = (typeof SUPPLIER_CONTACT_MOVES)[number]

/** Membre du compte fournisseur qu'un contact peut relier. */
export type SupplierTeamMemberOptionType = {
  id: number
  name: string
  email: string
}

/**
 * Celui qui consulte les contacts d'un fournisseur : l'organisation courante
 * de l'utilisateur connecté (son pays décide du filtre). `null` : visiteur non
 * connecté ou sans organisation utilisable — il ne reçoit aucun contact.
 */
export interface SupplierContactViewer {
  organizationId: number
  country: string | null
}

/** Contacts visibles par l'agence, par organisation fournisseur destinataire d'une demande. */
export type SupplierContactsByOrganization = Record<number, SupplierContactType[]>

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

/**
 * Props de l'écran « Équipe commerciale » de l'espace fournisseur.
 * `isSubscribed` : sans abonnement, l'équipe se prépare mais n'est pas montrée.
 */
export type SupplierContactsPageProps = {
  contacts: SupplierContactType[]
  members: SupplierTeamMemberOptionType[]
  showAllContacts: boolean
  isSubscribed: boolean
}
