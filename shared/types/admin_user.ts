import type { OrganizationKind } from './organization.js'
import type { RoleSlug } from './role.js'
import type { PlatformRole } from './user.js'

/**
 * Gestion des utilisateurs par la plateforme (#160).
 * Types exposés en props Inertia : des `type`, pas des `interface`.
 */

/** Filtres de la liste des utilisateurs (query string, étendus par rapport à `AdminUserFilters` de `admin.ts`). */
export type AdminUserIndexFilters = {
  /** Recherche partielle, insensible à la casse, sur l'email. `null` = aucune. */
  search: string | null
  /** Rôle plateforme. `any-role` = tout rôle sauf `none`. `null` = tous. */
  platformRole: PlatformRole | 'any-role' | null
  /** Statut de vérification email. `null` = tous. */
  emailVerified: 'verified' | 'unverified' | null
  /** Activité récente. `null` = tous. */
  activity: 'recent' | 'never' | null
  /** Type d'organisation du membre. `null` = tous. */
  organizationType: OrganizationKind | null
  /** Statut de suspension. `null` = tous. */
  status: 'active' | 'suspended' | null
}

/** Options de la liste utilisateurs passées en props Inertia pour les filtres. */
export type AdminUserFilterOptions = {
  platformRoles: (PlatformRole | 'any-role')[]
  organizationTypes: OrganizationKind[]
}

/** Ligne de la liste des utilisateurs. */
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

/** Organisation dont un utilisateur est membre (fiche utilisateur). */
export type AdminUserOrganization = {
  id: number
  name: string
  slug: string
  organizationType: OrganizationKind
  roleSlug: RoleSlug
  archivedAt: string | null
}

/** Passkey d'un utilisateur (fiche utilisateur). */
export type AdminUserPasskey = {
  id: number
  name: string
  createdAt: string
  lastUsedAt: string | null
}

/** Consentement légal d'un utilisateur (fiche utilisateur). */
export type AdminUserConsent = {
  id: number
  kind: string
  version: string
  acceptedAt: string
  organizationId: number
  organizationName: string | null
}

/** Fiche complète d'un utilisateur. */
export type AdminUserDetail = {
  id: number
  email: string
  fullName: string | null
  firstName: string | null
  lastName: string | null
  civility: string | null
  platformRole: PlatformRole
  emailVerified: boolean
  locale: string
  createdAt: string
  lastLoginAt: string | null
  suspendedAt: string | null
  organizations: AdminUserOrganization[]
  passkeys: AdminUserPasskey[]
  consents: AdminUserConsent[]
  /** Indicateurs d'actions possibles. */
  canSupport: boolean
  canManage: boolean
  isSelf: boolean
}
