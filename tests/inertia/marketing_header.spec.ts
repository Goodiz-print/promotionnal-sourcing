import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const pageState = vi.hoisted(() => ({
  url: '/fr/contact',
  props: { locale: 'fr', translations: {} as Record<string, string>, user: undefined as unknown },
}))

vi.mock('@inertiajs/vue3', () => ({ usePage: () => pageState }))

vi.mock('@adonisjs/inertia/vue', () => ({
  Link: defineComponent({
    props: { href: { type: String, default: '' } },
    setup(props, { slots }) {
      return () => h('a', { href: props.href }, slots.default?.())
    },
  }),
}))

vi.mock('~/client', () => ({
  urlFor: (name: string, params: { locale: string }) =>
    name === 'session.create' ? `/${params.locale}/login` : `/${params.locale}/products`,
}))

import MarketingHeader from '~/components/marketing/marketing_header.vue'

const TRANSLATIONS = {
  'landing.nav.login': 'Connexion',
  'landing.nav.openApp': "Accéder à l'app",
  'landing.nav.switchTo': 'English',
}

describe('marketing_header', () => {
  beforeEach(() => {
    pageState.url = '/fr/contact'
    pageState.props = { locale: 'fr', translations: TRANSLATIONS, user: undefined }
  })

  it('pointe le bouton Connexion vers la page de connexion de la locale courante', () => {
    const wrapper = mount(MarketingHeader)

    const login = wrapper.findAll('a').find((a) => a.text() === 'Connexion')
    expect(login?.attributes('href')).toBe('/fr/login')
  })

  it("affiche l'accès à l'application quand l'utilisateur est connecté", () => {
    pageState.props = { ...pageState.props, user: { id: 1 } }
    const wrapper = mount(MarketingHeader)

    const open = wrapper.findAll('a').find((a) => a.text() === "Accéder à l'app")
    expect(open?.attributes('href')).toBe('/fr/products')
    expect(wrapper.text()).not.toContain('Connexion')
  })

  it("le sélecteur de langue conserve la page courante dans l'autre langue", () => {
    const wrapper = mount(MarketingHeader)

    const other = wrapper.findAll('a').find((a) => a.text() === 'English')
    expect(other?.attributes('href')).toBe('/en/contact')
  })
})
