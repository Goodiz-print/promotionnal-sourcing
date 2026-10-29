import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { router } from '@inertiajs/vue3'
import type { CategoryFacetBarType } from '#shared/types/category'
import type { CertificationFacetBarType } from '#shared/types/certification'
import { MOQ_BUCKETS, PRICE_BUCKETS, type CatalogueNumericFacetsType } from '#shared/types/product'

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
  'products.index.filtersTitle': 'Filtres',
  'products.index.reset': 'Réinitialiser',
  'products.index.quickFilters': 'Filtres rapides',
  'products.index.emptyHint': 'Élargissez vos critères.',
  'products.card.minQuantity': '{count, plural, one {Min. # pièce} other {Min. # pièces}}',
  'products.card.madeInEurope': 'Fabriqué en Europe',
  'products.card.eco': 'Éco-responsable',
  'products.card.new': 'Nouveauté',
  'products.index.rangeUnder': '< {max}',
  'products.index.rangeOver': '≥ {min}',
  'products.index.rangeBetween': '{min}–{max}',
  'products.index.price.title': 'Prix',
  'products.index.price.currency': '€',
  'products.index.moq.title': 'Quantité minimum',
  'products.index.stock.title': 'Stock',
  'products.index.stock.in_stock': 'Disponible',
  'products.index.stock.out_of_stock': 'Épuisé',
  'products.index.stock.on_order': 'Sur commande',
  'products.index.certifications.title': 'Labels de conformité',
  'products.index.certifications.domains.environment': 'Environnement',
  'products.index.certifications.domains.textile': 'Textile',
  'products.show.backToCatalogue': 'Retour au catalogue',
  'documents.datasheet.title': 'Fiche technique',
  'products.show.viewImage': "Voir l'image",
  'products.show.minQuantity': 'Quantité minimum',
  'products.show.category': 'Catégorie',
  'products.show.origin': "Pays d'origine",
  'products.show.requestQuote': 'Demander un devis',
  'products.show.packaging': 'Conditionnement',
  'products.show.cartonDimensions': 'Dimensions carton maître (L × l × H, mm)',
  'products.manage.fields.packageType': 'Type de conditionnement',
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
    printable: false,
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

const certificationFacet: CertificationFacetBarType = {
  hasCounts: true,
  certifications: [
    { id: 20, slug: 'gots', name: 'GOTS', domain: 'textile', count: 2 },
    // Compteur 0 : masquée dans la barre quand les compteurs sont dispo.
    { id: 21, slug: 'grs', name: 'GRS', domain: 'environment', count: 0 },
  ],
}

const emptyCertificationFacet: CertificationFacetBarType = {
  certifications: [],
  hasCounts: false,
}

// Facettes prix / MOQ (plan L125) : toutes les tranches avec un compteur > 0 pour
// qu'aucune ne soit masquée dans la barre.
const numericFacets: CatalogueNumericFacetsType = {
  price: {
    hasCounts: true,
    buckets: PRICE_BUCKETS.map((bucket, index) => ({ ...bucket, index, count: 1 })),
  },
  moq: {
    hasCounts: true,
    buckets: MOQ_BUCKETS.map((bucket, index) => ({ ...bucket, index, count: 1 })),
  },
}

// Barre d'attributs avec une tranche numérique cliquable (plan L125).
const facetBarWithRange: CategoryFacetBarType = {
  hasCounts: true,
  attributes: [
    {
      attributeId: 2,
      name: 'Grammage',
      slug: 'grammage',
      type: 'number',
      unit: 'g',
      position: 1,
      values: [],
      ranges: [{ minValue: 400, maxValue: 600, count: 4 }],
    },
  ],
}

const meta = { total: 2, perPage: 12, currentPage: 1, lastPage: 1 }
const emptyFilters = {
  search: null,
  categoryId: 1,
  madeInEurope: false,
  attributeValueIds: [],
  certificationIds: [],
  originZones: [],
  stockStatuses: [],
  priceBuckets: [],
  moqBuckets: [],
  attributeRanges: [],
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
        certificationFacet,
        numericFacets,
      },
    })

    expect(wrapper.text()).toContain('Crayon Bleu')
    expect(wrapper.text()).toContain('Stylo Noir')
    // Carte produit : MOQ et badge made-in-Europe rendus depuis le type.
    expect(wrapper.text()).toContain('Min. 100 pièces')
    expect(wrapper.text()).toContain('Fabriqué en Europe')
    expect(wrapper.find('#search').exists()).toBe(true)
    expect(wrapper.find('#category').findAll('option')).toHaveLength(2)
    expect(wrapper.find('#madeInEurope').exists()).toBe(true)
    // La valeur avec compteur > 0 est rendue, avec son badge ; celle à 0 masquée.
    expect(wrapper.find('#attr-10').exists()).toBe(true)
    expect(wrapper.find('#attr-11').exists()).toBe(false)
    expect(wrapper.text()).toContain('3')
    // Barre certifications (transverse aux catégories) : label avec compteur > 0
    // rendu, label à 0 masqué, titre et domaine affichés.
    expect(wrapper.text()).toContain('Labels de conformité')
    expect(wrapper.find('#certification-20').exists()).toBe(true)
    expect(wrapper.find('#certification-21').exists()).toBe(false)
  })

  it('affiche un état vide', () => {
    const wrapper = mount(Index, {
      props: {
        searchUnavailable: false,
        products: { data: [], meta: { ...meta, total: 0 } },
        filters: emptyFilters,
        categories: [],
        facetBar: emptyFacetBar,
        certificationFacet: emptyCertificationFacet,
        numericFacets,
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
        certificationFacet: emptyCertificationFacet,
        numericFacets,
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
          certificationIds: [],
          originZones: [],
          stockStatuses: [],
          priceBuckets: [],
          moqBuckets: [],
          attributeRanges: [],
          newOnly: false,
          ecoOnly: false,
        },
        categories: [category(1, 'Crayon', 'crayon')],
        facetBar: emptyFacetBar,
        certificationFacet: emptyCertificationFacet,
        numericFacets,
      },
    })
    expect(wrapper.text()).toContain('Sélectionnez une catégorie pour afficher ses filtres.')
  })

  it('affiche la facette Stock et pousse le statut coché en query', async () => {
    vi.mocked(router.get).mockClear()
    const wrapper = mount(Index, {
      props: {
        searchUnavailable: false,
        products: { data: [], meta: { ...meta, total: 0 } },
        filters: emptyFilters,
        categories: [category(1, 'Crayon', 'crayon')],
        facetBar: emptyFacetBar,
        certificationFacet: emptyCertificationFacet,
        numericFacets,
      },
    })

    // La facette « Stock » (transverse) est toujours affichée, avec ses 3 statuts.
    expect(wrapper.text()).toContain('Stock')
    expect(wrapper.find('#stock-in_stock').exists()).toBe(true)
    expect(wrapper.find('#stock-out_of_stock').exists()).toBe(true)
    expect(wrapper.find('#stock-on_order').exists()).toBe(true)

    await wrapper.find('#stock-in_stock').setValue(true)

    expect(router.get).toHaveBeenCalledTimes(1)
    const params = vi.mocked(router.get).mock.calls[0][1] as { stockStatuses?: string[] }
    expect(params.stockStatuses).toEqual(['in_stock'])
  })

  it('affiche les facettes Prix et MOQ et pousse l’index du bucket coché', async () => {
    vi.mocked(router.get).mockClear()
    const wrapper = mount(Index, {
      props: {
        searchUnavailable: false,
        products: { data: [], meta: { ...meta, total: 0 } },
        filters: emptyFilters,
        categories: [category(1, 'Crayon', 'crayon')],
        facetBar: emptyFacetBar,
        certificationFacet: emptyCertificationFacet,
        numericFacets,
      },
    })

    // Facettes transverses toujours affichées, libellés rendus depuis les bornes.
    expect(wrapper.text()).toContain('Prix')
    expect(wrapper.text()).toContain('Quantité minimum')
    // Les id de cases MOQ utilisent le préfixe slug stable (pas le titre localisé
    // « Quantité minimum » qui donnerait un id HTML invalide avec espace).
    expect(wrapper.find('#numeric-moq-0').exists()).toBe(true)
    // Premier bucket prix (« < 1 € ») cliquable ; on coche le 3ᵉ (index 2 : 2–5 €).
    // L'id utilise un préfixe slug stable (`price`), jamais le titre localisé.
    expect(wrapper.find('#numeric-price-0').exists()).toBe(true)
    await wrapper.find('#numeric-price-2').setValue(true)

    expect(router.get).toHaveBeenCalledTimes(1)
    const params = vi.mocked(router.get).mock.calls[0][1] as { priceBuckets?: number[] }
    expect(params.priceBuckets).toEqual([2])
  })

  it('propose « Réinitialiser » dès qu’un filtre est actif et vide tout', async () => {
    vi.mocked(router.get).mockClear()
    const wrapper = mount(Index, {
      props: {
        searchUnavailable: false,
        products: { data: [], meta: { ...meta, total: 0 } },
        filters: { ...emptyFilters, madeInEurope: true, stockStatuses: ['in_stock'] },
        categories: [category(1, 'Crayon', 'crayon')],
        facetBar: emptyFacetBar,
        certificationFacet: emptyCertificationFacet,
        numericFacets,
      },
    })

    const reset = wrapper.findAll('button').find((button) => button.text() === 'Réinitialiser')
    expect(reset).toBeDefined()
    await reset!.trigger('click')

    expect(router.get).toHaveBeenCalledTimes(1)
    const params = vi.mocked(router.get).mock.calls[0][1] as Record<string, unknown>
    expect(params.categoryId).toBeUndefined()
    expect(params.madeInEurope).toBeUndefined()
    expect(params.stockStatuses).toBeUndefined()
    expect(params.page).toBe(1)
    // Plus aucun filtre actif → le bouton disparaît.
    expect(wrapper.findAll('button').some((button) => button.text() === 'Réinitialiser')).toBe(
      false
    )
  })

  it('masque « Réinitialiser » sans filtre actif', () => {
    const wrapper = mount(Index, {
      props: {
        searchUnavailable: false,
        products: { data: [], meta: { ...meta, total: 0 } },
        filters: { ...emptyFilters, categoryId: null },
        categories: [],
        facetBar: emptyFacetBar,
        certificationFacet: emptyCertificationFacet,
        numericFacets,
      },
    })
    expect(wrapper.text()).not.toContain('Réinitialiser')
  })

  it('rend une tranche d’attribut EAV cliquable et pousse slug:min:max', async () => {
    vi.mocked(router.get).mockClear()
    const wrapper = mount(Index, {
      props: {
        searchUnavailable: false,
        products: { data: [], meta: { ...meta, total: 0 } },
        filters: emptyFilters,
        categories: [category(1, 'Crayon', 'crayon')],
        facetBar: facetBarWithRange,
        certificationFacet: emptyCertificationFacet,
        numericFacets,
      },
    })

    // La tranche « 400–600 g » est désormais une case cliquable (filtrage actif).
    const range = wrapper.find('#attr-range-grammage-0')
    expect(range.exists()).toBe(true)
    await range.setValue(true)

    expect(router.get).toHaveBeenCalledTimes(1)
    const params = vi.mocked(router.get).mock.calls[0][1] as { attributeRanges?: string[] }
    expect(params.attributeRanges).toEqual(['grammage:400:600'])
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
          markingPositions: [],
          markingPriceTiers: [],
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

  it('regroupe les dimensions du carton (L × l × H) avec — pour une dimension manquante', () => {
    const wrapper = mount(Show, {
      props: {
        rfqContext: { canCreateRfq: false, drafts: [] },
        product: {
          ...product(2, 'Mug', 'mug'),
          supplier: { slug: 's', name: 'S', country: 'FR' },
          category: null,
          attributes: [],
          certifications: [],
          images: [],
          variants: [],
          priceTiers: [],
          documents: [],
          packaging: {
            packageType: 'Vrac',
            unitGrossWeightG: null,
            innerCartonQty: null,
            outerCartonQty: null,
            outerCartonLengthMm: 400,
            outerCartonWidthMm: null,
            outerCartonHeightMm: 250,
            outerCartonGrossWeightG: null,
            outerCartonVolumeM3: null,
          },
          markingPositions: [],
          markingPriceTiers: [],
        },
      },
    })

    expect(wrapper.text()).toContain('Conditionnement')
    expect(wrapper.text()).toContain('Vrac')
    // Largeur manquante → tiret cadratin à sa place.
    expect(wrapper.text()).toContain('400 × — × 250')
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
