/**
 * Rôle d'un utilisateur au niveau **plateforme** (par opposition au rôle dans
 * une organisation, cf. `shared/types/role.ts`). Le premier élément est la
 * valeur par défaut de la colonne `users.platform_role`.
 *
 * - `admin` : accès complet au back-office ;
 * - `moderator` : modération (organisations) ;
 * - `support` : assistance (comptes et organisations, en lecture) ;
 * - `analyst` : supervision en lecture seule (indicateurs, monitoring).
 */
export const PLATFORM_ROLES = ['none', 'admin', 'moderator', 'support', 'analyst'] as const

export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const DEFAULT_PLATFORM_ROLE: PlatformRole = 'none'

/**
 * Droits du back-office. Un rôle plateforme est un ensemble de droits
 * (`PLATFORM_ROLE_PERMISSIONS`) ; les routes et le menu raisonnent en droits,
 * jamais en rôles.
 */
export const PLATFORM_PERMISSIONS = [
  'backoffice.access',
  'users.view',
  'organizations.view',
  'catalogue.manage',
  'roles.manage',
  'audit.view',
  'monitoring.view',
  'moderation.manage',
] as const

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number]

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[]> = {
  none: [],
  admin: PLATFORM_PERMISSIONS,
  moderator: ['backoffice.access', 'organizations.view', 'moderation.manage'],
  support: ['backoffice.access', 'users.view', 'organizations.view'],
  analyst: ['backoffice.access', 'monitoring.view'],
}
