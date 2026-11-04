import type { OrganizationKind } from './organization.js'
import type { RoleSlug } from './role.js'
import type { PlatformRole } from './user.js'

/**
 * Compteurs du tableau de bord `/admin`. Les organisations archivées sont
 * comptées à part (`archivedOrganizations`) et exclues de `organizations`.
 */
export type AdminDashboardStats = {
  organizations: number
  archivedOrganizations: number
  users: number
  products: number
  rfqs: number
  /** Éléments en attente de modération (organisations fournisseurs + produits). */
  pendingModeration: number
  /** Inscriptions agence à revoir (motifs de revue non levés, agence non archivée). */
  pendingAgencyReviews: number
}

export const ADMIN_ORGANIZATION_STATUSES = ['active', 'archived', 'all'] as const

export type AdminOrganizationStatus = (typeof ADMIN_ORGANIZATION_STATUSES)[number]

export type AdminOrganizationFilters = {
  /** `null` = tous les types. */
  type: OrganizationKind | null
  status: AdminOrganizationStatus
}

// Extended AdminUserFilters with all index filters are in './admin_user.js'.
// Legacy type kept for existing code compatibility:
export type AdminUserFilters = {
  /** Recherche partielle, insensible à la casse, sur l'email. `null` = aucune. */
  search: string | null
}

/**
 * DTO déclarés en `type` (et non `interface`) pour rester assignables aux props
 * Inertia (cf. `OrganizationType`).
 */
export type AdminOrganizationListItem = {
  id: number
  name: string
  slug: string
  organizationType: OrganizationKind
  country: string
  membersCount: number
  archivedAt: string | null
  createdAt: string
}

export type AdminOrganizationMember = {
  id: number
  email: string
  fullName: string | null
  roleSlug: RoleSlug
  joinedAt: string
}

export type AdminOrganizationDetail = AdminOrganizationListItem & {
  email: string | null
  phone: string | null
  website: string | null
  siret: string | null
  vatNumber: string | null
  productsCount: number
  rfqsCount: number
  members: AdminOrganizationMember[]
}

export type AdminUserListItem = {
  id: number
  email: string
  fullName: string | null
  platformRole: PlatformRole
  emailVerified: boolean
  organizationsCount: number
  lastLoginAt: string | null
  suspendedAt: string | null
  createdAt: string
}

/**
 * Données de l'écran Utilisateurs nécessaires à la gestion des rôles
 * plateforme. `canManageRoles` ne pilote que l'affichage : le serveur
 * re-vérifie le droit `roles.manage`.
 */
export type AdminUsersRolesProps = {
  canManageRoles: boolean
  /** Compte de l'utilisateur connecté : il ne peut pas changer son propre rôle. */
  currentUserId: number
}
