import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { ProductFormKey } from '~/components/products/form/types'
import type { AttributeWithValuesType } from '#shared/types/attribute'

const translations = {
  'products.manage.index.title': 'Mes produits',
  'products.manage.index.empty': 'Aucun produit.',
  'products.manage.newProduct': 'Nouveau produit',
  'products.manage.edit': 'Modifier',
  'products.manage.delete': 'Supprimer',
  'products.manage.published': 'Publié',
  'products.manage.draft': 'Brouillon',
  'products.manage.noFacets': 'Aucune caractéristique.',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { get: vi.fn(), delete: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: () => '/fr/supplier/products' }))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Index } = await import('~/pages/supplier/products/index.vue')
const { default: BaseFileInput } = await import('~/components/base_file_input.vue')
const { default: ProductFacetsFields } =
  await import('~/components/products/form/product_facets_fields.vue')

function product(id: number, name: string, slug: string) {
  return {
    id,
    supplierId: 1,
    categoryId: 1,
    name,
    slug,
    reference: null,
    description: null,
    priceMin: null,
    priceMax: null,
    currency: 'EUR',
    minQuantity: null,
    imageUrl: null,
    originCountry: null,
    madeInEurope: true,
    isActive: true,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: null,
  }
}

describe('supplier/products/index.vue', () => {
  it('liste les produits + bouton nouveau', () => {
    const wrapper = mount(Index, {
      props: { products: [product(1, 'Crayon', 'crayon'), product(2, 'Stylo', 'stylo')] },
    })
    expect(wrapper.text()).toContain('Crayon')
    expect(wrapper.text()).toContain('Stylo')
    expect(wrapper.text()).toContain('Nouveau produit')
  })

  it('affiche un état vide', () => {
    const wrapper = mount(Index, { props: { products: [] } })
    expect(wrapper.text()).toContain('Aucun produit.')
  })
})

describe('base_file_input.vue', () => {
  it('émet les fichiers sélectionnés sur change', async () => {
    const wrapper = mount(BaseFileInput, { props: { id: 'files', multiple: true } })
    const input = wrapper.find('input')
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })

    await input.trigger('change')

    expect(wrapper.emitted('change')?.[0]?.[0]).toHaveLength(1)
  })
})

describe('product_facets_fields.vue', () => {
  it('cocher une valeur met à jour attributeValueIds du formulaire', async () => {
    const form = reactive({ attributeValueIds: [] as number[] })
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

    const wrapper = mount(ProductFacetsFields, {
      props: { attributes },
      global: { provide: { [ProductFormKey as symbol]: form } },
    })

    await wrapper.find('#facet-10').setValue(true)

    expect(form.attributeValueIds).toContain(10)
  })
})
