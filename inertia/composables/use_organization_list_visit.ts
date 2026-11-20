import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import type { AdminOrganizationIndexFilters } from '#shared/types/admin_organization'

/**
 * Visite GET de la liste des organisations : les filtres actifs passent en query
 * string (les `null` sont omis), l'état de la page est préservé et seules les
 * props de la liste sont rechargées.
 */
export function useOrganizationListVisit() {
  const { locale } = useI18n()

  function visit(filters: AdminOrganizationIndexFilters, page = 1) {
    const query: Record<string, string | number | boolean> = { page }
    for (const [key, value] of Object.entries(filters)) {
      if (value) query[key] = value
    }
    router.get(urlFor('admin.organizations.index', { locale: locale.value }), query, {
      preserveState: true,
      preserveScroll: true,
      only: ['organizationList', 'filters'],
    })
  }

  return { visit }
}
