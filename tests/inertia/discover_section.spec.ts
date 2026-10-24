import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CategoryType } from '#shared/types/category'

const translations: Record<string, string> = {
  'landing.discover.searchLabel': 'Rechercher un produit',
  'landing.discover.searchPlaceholder': 'Rechercher…',
  'landing.discover.searchSubmit': 'Rechercher',
  'landing.discover.buyerCta': 'Je suis acheteur',
  'landing.discover.supplierCta': 'Je suis fournisseur',
  'landing.discover.categoriesTitle': 'Catégories à découvrir',
}

const get = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations), router: { get } }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: { locale: string }) => `/${params.locale}/${name}`,
}))
vi.mock('@adonisjs/inertia/vue', () => ({
  Link: { props: ['href'], template: '<a :href="href"><slot /></a>' },
}))

const { default: DiscoverSection } = await import('~/components/marketing/discover_section.vue')

function category(id: number, name: string | null, slug = `cat-${id}`): CategoryType {
  return {
    id,
    name,
    slug,
    parentId: null,
    description: null,
    synonyms: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
  }
}

describe('DiscoverSection', () => {
  beforeEach(() => get.mockClear())

  it('envoie la recherche vers le catalogue avec le terme saisi', async () => {
    const wrapper = mount(DiscoverSection, { props: { categories: [] } })

    await wrapper.find('input[type="search"]').setValue('  tote bag ')
    await wrapper.find('form').trigger('submit')

    expect(get).toHaveBeenCalledWith('/fr/products.index', { search: 'tote bag' })
  })

  it('ouvre le catalogue sans filtre quand la recherche est vide', async () => {
    const wrapper = mount(DiscoverSection, { props: { categories: [] } })

    await wrapper.find('form').trigger('submit')

    expect(get).toHaveBeenCalledWith('/fr/products.index', {})
  })

  it("propose l'inscription acheteur et fournisseur", () => {
    const wrapper = mount(DiscoverSection, { props: { categories: [] } })
    const text = wrapper.text()

    expect(text).toContain('Je suis acheteur')
    expect(text).toContain('Je suis fournisseur')
  })

  it('lie chaque catégorie mise en avant au catalogue filtré', () => {
    const wrapper = mount(DiscoverSection, {
      props: { categories: [category(3, 'Textile'), category(4, null, 'sans-nom')] },
    })

    const links = wrapper.find('ul').findAll('a')
    expect(links.map((link) => link.text())).toEqual(['Textile', 'sans-nom'])
    expect(links[0].attributes('href')).toBe('/fr/products.index?categoryId=3')
  })

  it("masque la section catégories quand il n'y en a pas", () => {
    const wrapper = mount(DiscoverSection, { props: { categories: [] } })

    expect(wrapper.text()).not.toContain('Catégories à découvrir')
  })
})
