import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CategoryFacetBarType } from '#shared/types/category'

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
  'products.index.searchUnavailable': 'La recherche est momentanément indisponible.',
  'products.index.previous': 'Précédent',
  'products.index.next': 'Suivant',
  'products.index.selectCategoryForFilters':
    'Sélectionnez une catégorie pour afficher ses filtres.',
  'products.index.rangeUnder': '< {max}',
  'products.index.rangeOver': '≥ {min}',
  'products.index.rangeBetween': '{min}–{max}',
  'products.show.backToCatalogue': 'Retour au catalogue',
  'documents.datasheet.title': 'Fiche technique',
  'products.show.viewImage': "Voir l'image",
  'products.show.minQuantity': 'Quantité minimum',
  'products.show.category': 'Catégorie',
  'products.show.origin': "Pays d'origine",
  'products.show.requestQuote': 'Demander un devis',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { get: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: () => '/fr/products' }))
vi.mock('@adonisjs/inertia/vue', () => ({
  Link: { template: '<a><slot /></a>' },
}))

const { default: Index } = await import('~/pages/products/index.vue')
const { default: Show } = await import('~/pages/products/show.vue')
const { default: ProductGallery } = await import('~/components/product_gallery.vue')

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
    brand: null,
    hsCode: null,
    isConfigurable: false,
    lifecycleStatus: 'active' as const,
    releasedAt: null,
    supplierCategoryRaw: null,
    leadTimeDays: null,
    rushService: false,
    rushLeadTimeDays: null,
    videoUrl: null,
    originZone: 'france' as const,
    recycledContentPercent: null,
    cautionComment: null,
    isEco: false,
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

function facetValue(id: number, label: string, hex: string | null, count: number | null) {
  return {
    id,
    attributeId: 1,
    value: label.toLowerCase(),
    label,
    slug: label.toLowerCase(),
    synonyms: [],
    hex,
    parentValueId: null,
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: null,
    count,
  }
}

const facetBar: CategoryFacetBarType = {
  hasCounts: true,
  attributes: [
    {
      attributeId: 1,
      name: 'Couleur',
      slug: 'color',
      type: 'enum',
      unit: null,
      position: 1,
      values: [
        facetValue(10, 'Bleu', '#1F5FBF', 3),
        // Compteur 0 : masquée dans la barre quand les compteurs sont dispo.
        facetValue(11, 'Rouge', '#D62828', 0),
      ],
      ranges: [],
    },
  ],
}

const emptyFacetBar: CategoryFacetBarType = { attributes: [], hasCounts: false }

const meta = { total: 2, perPage: 12, currentPage: 1, lastPage: 1 }
const emptyFilters = {
  search: null,
  categoryId: 1,
  madeInEurope: false,
  attributeValueIds: [],
  originZones: [],
  newOnly: false,
  ecoOnly: false,
}

describe('products/index.vue', () => {
  it('affiche une carte par produit + la barre de filtres par catégorie', () => {
    const wrapper = mount(Index, {
      props: {
        searchUnavailable: false,
        products: {
          data: [product(1, 'Crayon Bleu', 'crayon-bleu'), product(2, 'Stylo Noir', 'stylo-noir')],
          meta,
        },
        filters: emptyFilters,
        categories: [category(1, 'Crayon', 'crayon')],
        facetBar,
      },
    })

    expect(wrapper.text()).toContain('Crayon Bleu')
    expect(wrapper.text()).toContain('Stylo Noir')
    expect(wrapper.find('#search').exists()).toBe(true)
    expect(wrapper.find('#category').findAll('option')).toHaveLength(2)
    expect(wrapper.find('#madeInEurope').exists()).toBe(true)
    // La valeur avec compteur > 0 est rendue, avec son badge ; celle à 0 masquée.
    expect(wrapper.find('#attr-10').exists()).toBe(true)
    expect(wrapper.find('#attr-11').exists()).toBe(false)
    expect(wrapper.text()).toContain('3')
  })

  it('affiche un état vide', () => {
    const wrapper = mount(Index, {
      props: {
        searchUnavailable: false,
        products: { data: [], meta: { ...meta, total: 0 } },
        filters: emptyFilters,
        categories: [],
        facetBar: emptyFacetBar,
      },
    })
    expect(wrapper.text()).toContain('Aucun produit ne correspond à votre recherche.')
  })

  it("annonce l'indisponibilité de la recherche au lieu d'un état vide", () => {
    const wrapper = mount(Index, {
      props: {
        searchUnavailable: true,
        products: { data: [], meta: { ...meta, total: 0 } },
        filters: emptyFilters,
        categories: [],
        facetBar: emptyFacetBar,
      },
    })
    expect(wrapper.text()).toContain('La recherche est momentanément indisponible.')
    expect(wrapper.text()).not.toContain('Aucun produit ne correspond à votre recherche.')
  })

  it('invite à choisir une catégorie quand aucune n’est sélectionnée', () => {
    const wrapper = mount(Index, {
      props: {
        searchUnavailable: false,
        products: { data: [], meta: { ...meta, total: 0 } },
        filters: {
          search: null,
          categoryId: null,
          madeInEurope: false,
          attributeValueIds: [],
          originZones: [],
          newOnly: false,
          ecoOnly: false,
        },
        categories: [category(1, 'Crayon', 'crayon')],
        facetBar: emptyFacetBar,
      },
    })
    expect(wrapper.text()).toContain('Sélectionnez une catégorie pour afficher ses filtres.')
  })
})

describe('products/show.vue', () => {
  it('affiche le produit, le fournisseur, le prix et les facettes', () => {
    const wrapper = mount(Show, {
      props: {
        rfqContext: { canCreateRfq: true, drafts: [] },
        product: {
          ...product(1, 'Crayon Aquarelle Bleu', 'crayon-aquarelle-bleu'),
          supplier: { slug: 'nordic-promo', name: 'Nordic Promo', country: 'SE' },
          category: { slug: 'crayon', name: 'Crayon' },
          attributes: [{ attributeSlug: 'color', attributeName: 'Couleur', label: 'Bleu' }],
          certifications: [],
          images: [
            {
              id: 1,
              url: 'https://img.example/a.jpg',
              position: 0,
              width: 800,
              height: 600,
              role: null,
              variants: [],
            },
          ],
          variants: [],
          priceTiers: [],
          documents: [
            {
              id: 3,
              originalName: 'fiche-crayon.pdf',
              sizeBytes: 2048,
              url: 'https://cellar.test/fiche.pdf',
              type: 'spec_sheet' as const,
            },
          ],
          packaging: null,
        },
      },
    })

    expect(wrapper.text()).toContain('Fiche technique')
    expect(wrapper.find('a[href="https://cellar.test/fiche.pdf"]').text()).toBe('fiche-crayon.pdf')
    expect(wrapper.text()).toContain('Crayon Aquarelle Bleu')
    expect(wrapper.text()).toContain('Nordic Promo')
    expect(wrapper.text()).toContain('1.50 – 2.00 EUR')
    expect(wrapper.text()).toContain('Couleur')
    expect(wrapper.text()).toContain('Bleu')
    expect(wrapper.text()).toContain('Demander un devis')
  })
})

describe('product_gallery.vue', () => {
  const image = (id: number, url: string, position: number) => ({
    id,
    url,
    position,
    width: 800,
    height: 600,
    role: null,
    variants: [],
  })

  it('affiche l’image principale + une miniature par image', () => {
    const wrapper = mount(ProductGallery, {
      props: {
        images: [
          image(1, 'https://img.example/a.jpg', 0),
          image(2, 'https://img.example/b.jpg', 1),
        ],
        fallbackUrl: null,
        alt: 'Produit',
      },
    })

    // 1 image principale + 2 miniatures.
    expect(wrapper.findAll('img')).toHaveLength(3)
    expect(wrapper.findAll('button')).toHaveLength(2)
  })

  it('sert les variantes (fiche en grand, carte en miniature) quand elles existent', () => {
    const wrapper = mount(ProductGallery, {
      props: {
        images: [
          {
            ...image(1, 'https://img.example/a.jpg', 0),
            variants: [
              {
                name: 'card' as const,
                url: 'https://img.example/a-card.webp',
                width: 400,
                height: 300,
              },
              {
                name: 'detail' as const,
                url: 'https://img.example/a-detail.webp',
                width: 800,
                height: 600,
              },
            ],
          },
          image(2, 'https://img.example/b.jpg', 1),
        ],
        fallbackUrl: null,
        alt: 'Produit',
      },
    })

    const sources = wrapper.findAll('img').map((img) => img.attributes('src'))
    // Image principale puis miniatures : l'image 2 n'a pas de variante → original.
    expect(sources).toEqual([
      'https://img.example/a-detail.webp',
      'https://img.example/a-card.webp',
      'https://img.example/b.jpg',
    ])
  })

  it('se replie sur fallbackUrl quand la galerie est vide', () => {
    const wrapper = mount(ProductGallery, {
      props: { images: [], fallbackUrl: 'https://img.example/fallback.jpg', alt: 'Produit' },
    })

    expect(wrapper.find('img').attributes('src')).toBe('https://img.example/fallback.jpg')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('ne rend aucune image sans galerie ni fallback', () => {
    const wrapper = mount(ProductGallery, {
      props: { images: [], fallbackUrl: null, alt: 'Produit' },
    })

    expect(wrapper.find('img').exists()).toBe(false)
  })
})
