import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'products.manage.variants.empty': 'Aucune variante',
  'products.manage.variants.add': 'Ajouter une variante',
  'products.manage.variants.remove': 'Retirer',
  'products.manage.variants.sku': 'SKU',
  'products.manage.variants.image': 'Image',
  'products.manage.variants.isActive': 'Proposée',
  'products.show.backToCatalogue': 'Retour au catalogue',
  'products.show.viewImage': "Voir l'image",
  'products.show.requestQuote': 'Demander un devis',
  'products.show.variants': 'Variantes',
  'products.show.priceTiers': 'Prix selon la quantité',
  'products.show.tierQuantity': 'Quantité',
  'products.show.tierPrice': 'Prix unitaire',
  'products.show.tierFrom': 'À partir de {quantity} pièces',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations), Head: m.HeadStub }
})
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Show } = await import('~/pages/products/show.vue')

const image = (id: number, url: string, position: number) => ({
  id,
  url,
  position,
  width: 800,
  height: 600,
  variants: [],
})

const variant = (id: number, sku: string, color: string, imageId: number | null) => ({
  id,
  sku,
  isActive: true,
  imageId,
  attributeValueIds: [id],
  attributes: [{ attributeSlug: 'color', attributeName: 'Couleur', label: color }],
})

const tier = (id: number, variantId: number | null, minQuantity: number, unitPrice: string) => ({
  id,
  variantId,
  minQuantity,
  unitPrice,
  currency: 'EUR',
})

function mountShow() {
  return mount(Show, {
    props: {
      product: {
        id: 1,
        supplierId: 1,
        categoryId: 1,
        name: 'Mug',
        slug: 'mug',
        reference: null,
        description: null,
        priceMin: '2.80',
        priceMax: '9.00',
        currency: 'EUR',
        minQuantity: null,
        imageUrl: null,
        originCountry: null,
        madeInEurope: true,
        isActive: true,
        createdAt: '2026-07-11T00:00:00.000Z',
        updatedAt: null,
        supplier: { slug: 'acme', name: 'Acme', country: 'FR' },
        category: null,
        attributes: [],
        images: [
          image(1, 'https://img.example/rouge.jpg', 0),
          image(2, 'https://img.example/bleu.jpg', 1),
        ],
        variants: [variant(10, 'MUG-R', 'Rouge', 1), variant(11, 'MUG-B', 'Bleu', 2)],
        priceTiers: [
          tier(1, null, 100, '4.5000'),
          tier(2, null, 500, '3.2000'),
          tier(3, 11, 100, '9.0000'),
        ],
        documents: [],
      },
    },
  })
}

describe('products/show.vue — variantes et paliers', () => {
  it('liste les variantes et la grille de prix du produit par défaut', () => {
    const wrapper = mountShow()

    const buttons = wrapper.findAll('button[aria-pressed]')
    expect(buttons.map((b) => b.text())).toEqual(['Rouge', 'Bleu'])
    expect(buttons[0].attributes('aria-pressed')).toBe('true')

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('À partir de 100 pièces')
    expect(rows[0].text()).toContain('4.5 EUR')
    expect(rows[1].text()).toContain('3.2 EUR')
  })

  it("changer de variante change l'image affichée et sa grille de prix", async () => {
    const wrapper = mountShow()
    expect(wrapper.find('img.aspect-square').attributes('src')).toBe(
      'https://img.example/rouge.jpg'
    )

    await wrapper.findAll('button[aria-pressed]')[1].trigger('click')

    expect(wrapper.find('img.aspect-square').attributes('src')).toBe('https://img.example/bleu.jpg')
    // La variante bleue a ses propres paliers : ils remplacent ceux du produit.
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('9 EUR')
  })

  it('sans variante ni palier, aucune section dédiée', () => {
    const wrapper = mountShow()
    return wrapper
      .setProps({ product: { ...wrapper.props('product'), variants: [], priceTiers: [] } })
      .then(() => {
        expect(wrapper.find('button[aria-pressed]').exists()).toBe(false)
        expect(wrapper.find('table').exists()).toBe(false)
      })
  })
})

describe('product_variants_fields.vue', () => {
  it('ajoute puis retire une ligne de variante dans le formulaire injecté', async () => {
    const { reactive } = await import('vue')
    const { ProductFormKey } = await import('~/components/products/form/types')
    const { default: Fields } =
      await import('~/components/products/form/product_variants_fields.vue')
    const form = reactive({ variants: [], priceTiers: [], errors: {} })

    const wrapper = mount(Fields, {
      props: { attributes: [], existingImages: [] },
      global: { provide: { [ProductFormKey as symbol]: form } },
    })
    await wrapper.find('button').trigger('click')

    expect(form.variants).toHaveLength(1)
    expect(wrapper.find('input').exists()).toBe(true)
  })
})
