import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { NavigationItemType } from '#shared/types/navigation'

const translations: Record<string, string> = {
  'common.nav.main': 'Navigation principale',
  'common.nav.dashboard': 'Tableau de bord',
  'common.nav.catalogue': 'Catalogue',
  'common.nav.suppliers': 'Fournisseurs',
  'common.nav.rfqs': 'Mes demandes de devis',
  'common.nav.members': 'Membres',
}

const pageState: { url: string; navigation: NavigationItemType[] } = { url: '/fr', navigation: [] }

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({
    url: pageState.url,
    props: {
      locale: 'fr',
      supportedLocales: ['fr', 'en'],
      translations,
      navigation: pageState.navigation,
    },
  }),
}))
vi.mock('~/client', () => ({
  urlFor: (name: string, params: { locale: string }) =>
    `/${params.locale}/${name.replace('.index', '').replace('.show', '')}`,
}))
vi.mock('@adonisjs/inertia/vue', () => ({
  Link: {
    props: ['route', 'params'],
    template: '<a :data-route="route" :aria-current="$attrs[\'aria-current\']"><slot /></a>',
  },
}))

const { default: AppNav } = await import('~/components/app_nav.vue')

function item(key: string, route: NavigationItemType['route']): NavigationItemType {
  return { key, route, labelKey: `common.nav.${key}` }
}

describe('AppNav', () => {
  beforeEach(() => {
    pageState.url = '/fr'
    pageState.navigation = []
  })

  it('affiche les entrées fournies par le serveur, traduites', () => {
    pageState.navigation = [item('catalogue', 'products.index'), item('rfqs', 'rfqs.index')]

    const wrapper = mount(AppNav)

    expect(wrapper.findAll('a').map((link) => link.text())).toEqual([
      'Catalogue',
      'Mes demandes de devis',
    ])
  })

  it("n'affiche aucune entrée quand le serveur n'en fournit pas", () => {
    expect(mount(AppNav).findAll('a')).toHaveLength(0)
  })

  it("marque l'entrée de la page courante (et de ses pages enfants) comme active", () => {
    pageState.url = '/fr/rfqs/12?tab=items'
    pageState.navigation = [item('catalogue', 'products.index'), item('rfqs', 'rfqs.index')]

    const links = mount(AppNav).findAll('a')

    expect(links[0].attributes('aria-current')).toBeUndefined()
    expect(links[1].attributes('aria-current')).toBe('page')
  })

  it('ne confond pas deux routes dont les chemins partagent un préfixe', () => {
    pageState.url = '/fr/rfqs-archive'
    pageState.navigation = [item('rfqs', 'rfqs.index')]

    expect(mount(AppNav).find('a').attributes('aria-current')).toBeUndefined()
  })

  it('passe en colonne en orientation verticale', () => {
    const wrapper = mount(AppNav, { props: { orientation: 'vertical' } })

    expect(wrapper.find('nav').classes()).toContain('flex-col')
  })
})
