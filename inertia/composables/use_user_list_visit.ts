import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import type { AdminUserIndexFilters } from '#shared/types/admin_user'

/**
 * Visite GET de la liste des utilisateurs : les filtres actifs passent en query
 * string (les `null` sont omis), l'état de la page est préservé et seules les
 * props de la liste sont rechargées.
 */
export function useUserListVisit() {
  const { locale } = useI18n()

  function visit(filters: AdminUserIndexFilters, page = 1) {
    const query: Record<string, string | number> = { page }
    for (const [key, value] of Object.entries(filters)) {
      if (value) query[key] = value
    }
    router.get(urlFor('admin.users.index', { locale: locale.value }), query, {
      preserveState: true,
      preserveScroll: true,
      only: ['users', 'filters'],
    })
  }

  return { visit }
}
