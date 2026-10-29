import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import type { Data } from '@generated/data'
import { urlFor } from '~/client'
import { useI18n } from '~/i18n'
import { isActivePath } from '#shared/helpers/navigation'

/**
 * Onglets de l'espace organisation (`BaseTabs`) : paramètres et membres.
 * L'onglet courant est déduit de l'URL de la page (`isActivePath`).
 *
 * `createHref` / `createLabel` portent le point d'entrée de la création d'une
 * organisation supplémentaire (slot `actions` des onglets) : le sélecteur
 * d'organisation étant masqué tant qu'on n'en a qu'une, il ne peut pas porter
 * cette action.
 */
const SECTIONS = [
  { key: 'settings', route: 'organization.settings' },
  { key: 'members', route: 'organization.members' },
] as const

export function useOrganizationTabs() {
  const page = usePage<Data.SharedProps>()
  const { t, locale } = useI18n()

  const items = computed(() => {
    const currentUrl = page.url ?? ''
    return SECTIONS.map((section) => {
      const href = urlFor(section.route, { locale: locale.value })
      return {
        href,
        label: t(`organization.nav.${section.key}`),
        active: isActivePath(currentUrl, href),
      }
    })
  })

  const label = computed(() => t('organization.nav.label'))
  const createHref = computed(() => urlFor('organization.create', { locale: locale.value }))
  const createLabel = computed(() => t('organization.nav.create'))

  return { items, label, createHref, createLabel }
}
