import type { AdminActionContext } from '#shared/types/admin_audit'

/**
 * Rattachement des fiches fournisseur importées à l'organisation du
 * fournisseur (#231). Types exposés en props Inertia : des `type`, pas des
 * `interface` (cf. `admin_demand.ts`).
 */

/**
 * Filtre de l'écran : `pending` (par défaut) = fiches sans organisation, en
 * attente de l'accord du fournisseur ; `linked` = fiches rattachées.
 */
export const SUPPLIER_LINK_FILTERS = ['pending', 'linked'] as const

export type SupplierLinkFilter = (typeof SUPPLIER_LINK_FILTERS)[number]

export type AdminSupplierLinkFilters = {
  status: SupplierLinkFilter
}

/**
 * Pourquoi une organisation est proposée : même adresse email (de
 * l'organisation ou d'un membre), ou même domaine (email ou site web).
 */
export type SupplierLinkMatch = 'email' | 'domain'

export type SupplierLinkSuggestion = {
  organizationId: number
  organizationName: string
  match: SupplierLinkMatch
}

/** Organisation fournisseur proposée au rattachement (liste de choix). */
export type SupplierLinkOrganizationOption = {
  id: number
  name: string
}

/** Ligne de l'écran : une fiche fournisseur. */
export type AdminSupplierLinkItem = {
  id: number
  slug: string
  name: string
  country: string
  email: string | null
  website: string | null
  productsCount: number
  /** Organisation rattachée, `null` pour une fiche en attente. */
  organization: SupplierLinkOrganizationOption | null
  linkedAt: string | null
  linkedByEmail: string | null
  /** Organisation proposée pour une fiche en attente, `null` sinon. */
  suggestion: SupplierLinkSuggestion | null
}

/** Coordonnées d'une fiche, entrée du calcul de suggestion. */
export type SupplierLinkContact = {
  email: string | null
  website: string | null
}

/**
 * Organisation candidate au rattachement, avec ce qui permet de la
 * reconnaître : son email, son site et les emails de ses membres.
 */
export type SupplierLinkCandidate = {
  id: number
  name: string
  email: string | null
  website: string | null
  memberEmails: string[]
}

/** Email d'un membre d'une organisation candidate (ligne SQL brute). */
export type SupplierLinkMemberRow = {
  organization_id: number
  email: string
}

export type SupplierLinkListOptions = AdminSupplierLinkFilters & {
  page: number
  perPage: number
  locale: string
}

export type SupplierLinkOptions = {
  supplierId: number
  organizationId: number
  context: AdminActionContext
}

export type SupplierUnlinkOptions = {
  supplierId: number
  context: AdminActionContext
}
