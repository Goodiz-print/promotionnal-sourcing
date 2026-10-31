import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import type { Data } from '@generated/data'
import { platformRoleHasPermission } from '#shared/helpers/platform_permissions'
import type { PlatformPermission } from '#shared/types/user'

/**
 * Droits du back-office de l'utilisateur connecté, déduits de son rôle plateforme
 * (même matrice que le serveur). Sert uniquement à n'afficher que les sections
 * accessibles : chaque route re-vérifie son droit côté serveur.
 */
export function usePlatformPermissions() {
  const page = usePage<Data.SharedProps>()
  const role = computed(() => page.props.user?.platformRole)

  function can(permission: PlatformPermission): boolean {
    return platformRoleHasPermission(role.value, permission)
  }

  return { can }
}
