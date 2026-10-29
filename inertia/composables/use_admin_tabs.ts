import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import type { Data } from '@generated/data'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { isActivePath } from '#shared/helpers/navigation'

/**
 * Onglets du back-office (`BaseTabs`) : tableau de bord, organisations,
 * utilisateurs, catégories. L'onglet courant est déduit de l'URL de la page
 * (`isActivePath`) ; `/admin` étant le parent de toutes les autres sections,
 * il n'est actif que si aucun onglet plus précis ne l'est.
 */
const SECTIONS = [
  { key: 'dashboard', route: 'admin.dashboard' },
  { key: 'organizations', route: 'admin.organizations.index' },
  { key: 'users', route: 'admin.users.index' },
  { key: 'categories', route: 'admin.categories.index' },
] as const

export function useAdminTabs() {
  const page = usePage<Data.SharedProps>()
  const { t, locale } = useI18n()

  const items = computed(() => {
    const currentUrl = page.url ?? ''
    const tabs = SECTIONS.map((section) => {
      const href = urlFor(section.route, { locale: locale.value })
      return {
        key: section.key,
        href,
        label: t(`admin.nav.${section.key}`),
        active: isActivePath(currentUrl, href),
      }
    })
    const childActive = tabs.some((tab) => tab.key !== 'dashboard' && tab.active)
    return tabs.map((tab) =>
      tab.key === 'dashboard' ? { ...tab, active: tab.active && !childActive } : tab
    )
  })

  const label = computed(() => t('admin.nav.label'))

  return { items, label }
}
