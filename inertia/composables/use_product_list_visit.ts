import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import type { AdminProductIndexFilters } from '#shared/types/admin_product'

/**
 * Visite GET de la liste des produits : les filtres actifs passent en query
 * string (les `null` sont omis), l'état de la page est préservé et seules les
 * props de la liste sont rechargées.
 */
export function useProductListVisit() {
  const { locale } = useI18n()

  function visit(filters: AdminProductIndexFilters, page = 1) {
    const query: Record<string, string | number> = { page }
    for (const [key, value] of Object.entries(filters)) {
      if (value) query[key] = value
    }
    router.get(urlFor('admin.products.index', { locale: locale.value }), query, {
      preserveState: true,
      preserveScroll: true,
      only: ['productList', 'filters'],
    })
  }

  return { visit }
}
