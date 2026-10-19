/**
 * Rôle d'un utilisateur au niveau **plateforme** (par opposition au rôle dans
 * une organisation, cf. `shared/types/role.ts`). Le premier élément est la
 * valeur par défaut de la colonne `users.platform_role`.
 */
export const PLATFORM_ROLES = ['none', 'admin'] as const

export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const DEFAULT_PLATFORM_ROLE: PlatformRole = 'none'
