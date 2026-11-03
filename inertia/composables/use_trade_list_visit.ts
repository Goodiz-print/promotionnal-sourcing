import { router } from '@inertiajs/vue3'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import type { TradeFilterValues } from '~/components/admin/types'

type TradeListRoute = 'admin.rfqs.index' | 'admin.quotes.index' | 'admin.orders.index'

/**
 * Visite GET d'une liste de supervision : les filtres actifs passent en query
 * string (les `null` sont omis), l'état de la page est préservé et seules les
 * props de la liste sont rechargées.
 */
export function useTradeListVisit(route: TradeListRoute, only: string[]) {
  const { locale } = useI18n()
  function visit(filters: Partial<TradeFilterValues>, page = 1) {
    const query: Record<string, string | number> = { page }
    for (const [key, value] of Object.entries(filters)) {
      if (value) query[key] = value
    }
    router.get(urlFor(route, { locale: locale.value }), query, {
      preserveState: true,
      preserveScroll: true,
      only,
    })
  }

  /** Les filtres sont ceux de la page (props serveur) : ils suivent aussi l'historique du navigateur. */
  const goToPage = (filters: Partial<TradeFilterValues>, page: number) => visit(filters, page)

  return { visit, goToPage }
}
