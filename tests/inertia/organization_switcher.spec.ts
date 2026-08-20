import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { OrganizationSummaryType } from '#shared/types/organization'
import type { RoleType } from '#shared/types/role'

const translations = {
  'organization.switch.label': 'Organisation',
}

const pageProps: {
  organizations: OrganizationSummaryType[]
  currentOrganizationId: number | null
} = { organizations: [], currentOrganizationId: null }

const post = vi.fn()

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({
    props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations, ...pageProps },
  }),
  router: {
    post: (...args: unknown[]) => post(...args),
  },
}))

vi.mock('~/client', () => ({
  urlFor: (name: string, params: Record<string, unknown>) =>
    `/fr/${name}/${String(params.id ?? '')}`,
}))

const { default: OrganizationSwitcher } =
  await import('~/components/organization/organization_switcher.vue')

function role(): RoleType {
  return { id: 1, name: 'Owner', slug: 'owner', description: null }
}

function organization(id: number, name: string): OrganizationSummaryType {
  return { id, name, slug: name.toLowerCase(), logoUrl: null, role: role() }
}

describe('OrganizationSwitcher', () => {
  beforeEach(() => {
    post.mockClear()
    pageProps.organizations = []
    pageProps.currentOrganizationId = null
  })

  it("reste masqué quand l'utilisateur n'a qu'une organisation", () => {
    pageProps.organizations = [organization(1, 'Acme')]
    pageProps.currentOrganizationId = 1

    const wrapper = mount(OrganizationSwitcher)

    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('liste les organisations et sélectionne la courante au-delà de la première', () => {
    pageProps.organizations = [organization(1, 'Acme'), organization(2, 'Beta')]
    pageProps.currentOrganizationId = 2

    const wrapper = mount(OrganizationSwitcher)
    const select = wrapper.find('select')

    expect(select.exists()).toBe(true)
    expect(wrapper.findAll('option').map((option) => option.text())).toEqual(['Acme', 'Beta'])
    expect((select.element as HTMLSelectElement).value).toBe('2')
  })

  it('poste la bascule au changement, et ne fait rien si on rechoisit la courante', async () => {
    pageProps.organizations = [organization(1, 'Acme'), organization(2, 'Beta')]
    pageProps.currentOrganizationId = 2

    const wrapper = mount(OrganizationSwitcher)
    const select = wrapper.find('select')

    await select.setValue('1')
    expect(post).toHaveBeenCalledWith('/fr/organization.switch/1', {}, { preserveScroll: true })

    post.mockClear()
    await select.setValue('2')
    expect(post).not.toHaveBeenCalled()
  })
})
