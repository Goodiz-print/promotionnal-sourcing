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
  'common.nav.groups.explore': 'Explorer',
  'common.nav.groups.buying': 'Achats',
  'common.nav.groups.organization': 'Organisation',
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
    props: ['href'],
    template: '<a :href="href" :aria-current="$attrs[\'aria-current\']"><slot /></a>',
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

describe('AppNav — groupes', () => {
  it('regroupe les entrées par domaine avec un titre de groupe quand il y en a plusieurs', () => {
    pageState.navigation = [
      item('dashboard', 'dashboard.show'),
      item('rfqs', 'rfqs.index'),
      item('members', 'organization.members'),
    ]

    const wrapper = mount(AppNav)
    const groupLabels = wrapper.findAll('p').map((p) => p.text())

    expect(groupLabels).toEqual(['Explorer', 'Achats', 'Organisation'])
    expect(wrapper.findAll('a svg')).toHaveLength(3)
  })

  it("n'affiche pas de titre de groupe quand toutes les entrées sont dans le même groupe", () => {
    pageState.navigation = [
      item('catalogue', 'products.index'),
      item('suppliers', 'suppliers.index'),
    ]

    expect(mount(AppNav).findAll('p')).toHaveLength(0)
  })
})

describe('AppNav — réduit', () => {
  it('garde libellés et titres pour les lecteurs d’écran quand le menu est réduit', () => {
    pageState.url = '/fr'
    pageState.navigation = [item('dashboard', 'dashboard.show'), item('rfqs', 'rfqs.index')]

    const links = mount(AppNav, { props: { collapsed: true } }).findAll('a')

    expect(links[0].attributes('title')).toBe('Tableau de bord')
    expect(links[0].get('span').classes()).toContain('md:sr-only')
    expect(links[0].classes()).toContain('md:justify-center')
  })
})
