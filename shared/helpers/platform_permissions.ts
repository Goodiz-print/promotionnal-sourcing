import { PLATFORM_ROLE_PERMISSIONS } from '#shared/types/user'
import type { PlatformPermission, PlatformRole } from '#shared/types/user'

/**
 * Le rôle plateforme donne-t-il ce droit ? Partagé backend (ability Bouncer) et
 * frontend (onglets du back-office) : le front n'affiche que ce que le serveur
 * autorisera, mais chaque route re-vérifie.
 */
export function platformRoleHasPermission(
  role: PlatformRole | null | undefined,
  permission: PlatformPermission
): boolean {
  if (!role) return false
  return PLATFORM_ROLE_PERMISSIONS[role].includes(permission)
}
