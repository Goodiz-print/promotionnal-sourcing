import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import type { Data } from '@generated/data'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { usePlatformPermissions } from '~/composables/use_platform_permissions'
import { isActivePath } from '#shared/helpers/navigation'
import type { PlatformPermission } from '#shared/types/user'

/**
 * Onglets du back-office (`BaseTabs`) : tableau de bord, organisations,
 * utilisateurs, produits, catégories, attributs, certifications, techniques de marquage, modération, agences, demandes de devis, devis, commandes, demande des clients, journal d'audit. Seules les sections dont le rôle
 * plateforme porte le droit sont affichées. L'onglet courant est déduit de
 * l'URL de la page (`isActivePath`) ; `/admin` étant le parent de toutes les
 * autres sections, il n'est actif que si aucun onglet plus précis ne l'est.
 */
const SECTIONS: { key: string; route: string; permission: PlatformPermission }[] = [
  { key: 'dashboard', route: 'admin.dashboard', permission: 'backoffice.access' },
  { key: 'organizations', route: 'admin.organizations.index', permission: 'organizations.view' },
  { key: 'users', route: 'admin.users.index', permission: 'users.view' },
  { key: 'products', route: 'admin.products.index', permission: 'products.view' },
  { key: 'categories', route: 'admin.categories.index', permission: 'catalogue.manage' },
  { key: 'attributes', route: 'admin.attributes.index', permission: 'catalogue.manage' },
  { key: 'certifications', route: 'admin.certifications.index', permission: 'catalogue.manage' },
  {
    key: 'markingTechniques',
    route: 'admin.marking_techniques.index',
    permission: 'catalogue.manage',
  },
  { key: 'moderation', route: 'admin.moderation.index', permission: 'moderation.manage' },
  { key: 'agencies', route: 'admin.agency_reviews.index', permission: 'moderation.manage' },
  { key: 'messaging', route: 'admin.messaging.index', permission: 'moderation.manage' },
  { key: 'rfqs', route: 'admin.rfqs.index', permission: 'trade.view' },
  { key: 'quotes', route: 'admin.quotes.index', permission: 'trade.view' },
  { key: 'orders', route: 'admin.orders.index', permission: 'trade.view' },
  { key: 'demand', route: 'admin.demand.index', permission: 'monitoring.view' },
  { key: 'audit', route: 'admin.audit.index', permission: 'audit.view' },
]

export function useAdminTabs() {
  const page = usePage<Data.SharedProps>()
  const { t, locale } = useI18n()
  const { can } = usePlatformPermissions()

  const items = computed(() => {
    const currentUrl = page.url ?? ''
    const tabs = SECTIONS.filter((section) => can(section.permission)).map((section) => {
      const href = urlFor(section.route as 'admin.dashboard', { locale: locale.value })
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
