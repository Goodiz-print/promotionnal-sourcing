import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AttributeWithValuesType } from '#shared/types/attribute'

const translations = {
  'products.index.title': 'Catalogue produits',
  'products.index.subtitle': 'Recherchez et filtrez les produits.',
  'products.index.searchLabel': 'Recherche',
  'products.index.searchPlaceholder': 'Nom…',
  'products.index.category': 'Catégorie',
  'products.index.allCategories': 'Toutes les catégories',
  'products.index.madeInEurope': 'Fabriqué en Europe',
  'products.index.resultsCount':
    '{count, plural, =0 {Aucun produit} one {# produit} other {# produits}}',
  'products.index.empty': 'Aucun produit ne correspond à votre recherche.',
  'products.index.previous': 'Précédent',
  'products.index.next': 'Suivant',
  'products.show.backToCatalogue': 'Retour au catalogue',
  'products.show.minQuantity': 'Quantité minimum',
  'products.show.category': 'Catégorie',
  'products.show.origin': "Pays d'origine",
  'products.show.requestQuote': 'Demander un devis',
}

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({ props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations } }),
  router: { get: vi.fn() },
  Head: { render: () => null },
}))
vi.mock('~/client', () => ({ urlFor: () => '/fr/products' }))
vi.mock('@adonisjs/inertia/vue', () => ({
  Link: { template: '<a><slot /></a>' },
}))

const { default: Index } = await import('~/pages/products/index.vue')
const { default: Show } = await import('~/pages/products/show.vue')

function product(id: number, name: string, slug: string) {
  return {
    id,
    supplierId: 1,
    categoryId: 1,
    name,
    slug,
    reference: null,
    description: 'Un produit',
    priceMin: '1.50',
    priceMax: '2.00',
    currency: 'EUR',
    minQuantity: 100,
    imageUrl: null,
    originCountry: 'FR',
    madeInEurope: true,
    isActive: true,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: null,
  }
}

function category(id: number, name: string, slug: string) {
  return {
    id,
    name,
    slug,
    parentId: null,
    description: null,
    synonyms: [],
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: null,
  }
}

const attributes: AttributeWithValuesType[] = [
  {
    id: 1,
    name: 'Couleur',
    slug: 'color',
    type: 'enum',
    unit: null,
    isFilterable: true,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: null,
    values: [
      {
        id: 10,
        attributeId: 1,
        value: 'blue',
        label: 'Bleu',
        slug: 'blue',
        synonyms: [],
        createdAt: '2026-07-11T00:00:00.000Z',
        updatedAt: null,
      },
    ],
  },
]

const meta = { total: 2, perPage: 12, currentPage: 1, lastPage: 1 }
const emptyFilters = { search: null, categoryId: null, madeInEurope: false, attributeValueIds: [] }

describe('products/index.vue', () => {
  it('affiche une carte par produit + la barre de filtres', () => {
    const wrapper = mount(Index, {
      props: {
        products: {
          data: [product(1, 'Crayon Bleu', 'crayon-bleu'), product(2, 'Stylo Noir', 'stylo-noir')],
          meta,
        },
        filters: emptyFilters,
        categories: [category(1, 'Crayon', 'crayon')],
        attributes,
      },
    })

    expect(wrapper.text()).toContain('Crayon Bleu')
    expect(wrapper.text()).toContain('Stylo Noir')
    expect(wrapper.find('#search').exists()).toBe(true)
    expect(wrapper.find('#category').findAll('option')).toHaveLength(2)
    expect(wrapper.find('#madeInEurope').exists()).toBe(true)
    expect(wrapper.find('#attr-10').exists()).toBe(true)
  })

  it('affiche un état vide', () => {
    const wrapper = mount(Index, {
      props: {
        products: { data: [], meta: { ...meta, total: 0 } },
        filters: emptyFilters,
        categories: [],
        attributes: [],
      },
    })
    expect(wrapper.text()).toContain('Aucun produit ne correspond à votre recherche.')
  })
})

describe('products/show.vue', () => {
  it('affiche le produit, le fournisseur, le prix et les facettes', () => {
    const wrapper = mount(Show, {
      props: {
        product: {
          ...product(1, 'Crayon Aquarelle Bleu', 'crayon-aquarelle-bleu'),
          supplier: { slug: 'nordic-promo', name: 'Nordic Promo', country: 'SE' },
          category: { slug: 'crayon', name: 'Crayon' },
          attributes: [{ attributeSlug: 'color', attributeName: 'Couleur', label: 'Bleu' }],
        },
      },
    })

    expect(wrapper.text()).toContain('Crayon Aquarelle Bleu')
    expect(wrapper.text()).toContain('Nordic Promo')
    expect(wrapper.text()).toContain('1.50 – 2.00 EUR')
    expect(wrapper.text()).toContain('Couleur')
    expect(wrapper.text()).toContain('Bleu')
    expect(wrapper.text()).toContain('Demander un devis')
  })
})
