import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const translations = {
  'suppliers.index.title': 'Annuaire des fournisseurs',
  'suppliers.index.subtitle': 'Parcourez les fournisseurs.',
  'suppliers.index.searchLabel': 'Recherche',
  'suppliers.index.searchPlaceholder': 'Nom…',
  'suppliers.index.country': 'Pays',
  'suppliers.index.allCountries': 'Tous les pays',
  'suppliers.index.empty': 'Aucun fournisseur.',
  'suppliers.index.previous': 'Précédent',
  'suppliers.index.next': 'Suivant',
  'suppliers.show.website': 'Visiter le site',
  'suppliers.show.profile': 'Profil fournisseur',
  'suppliers.show.products': 'Catalogue',
  'suppliers.show.noProducts': 'Aucun produit.',
  'supplier.fields.deliveryScope': 'Périmètre de livraison',
  'supplier.fields.minOrderQuantity': 'Quantité minimum',
  'supplier.fields.deliveryDays': 'Délai de livraison',
  'supplier.fields.responseTimeDays': 'Délai de réponse',
  'supplier.deliveryScope.europe': 'Europe',
  'documents.title': 'Documents',
  'documents.kinds.catalogue': 'Catalogue',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { get: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: () => '/fr/suppliers' }))
vi.mock('@adonisjs/inertia/vue', () => ({
  Link: { template: '<a><slot /></a>' },
}))

const { default: Index } = await import('~/pages/suppliers/index.vue')
const { default: Show } = await import('~/pages/suppliers/show.vue')
const { default: ProductCard } = await import('~/components/product_card.vue')

function supplier(slug: string, name: string) {
  return {
    id: slug.length,
    name,
    slug,
    country: 'FR',
    website: null,
    email: null,
    phone: null,
    description: 'desc',
    logoUrl: null,
    isActive: true,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: null,
  }
}

function product() {
  return {
    id: 1,
    supplierId: 1,
    categoryId: 1,
    name: 'Crayon',
    slug: 'p1',
    reference: null,
    description: null,
    priceMin: '1.50',
    priceMax: '2.00',
    currency: 'EUR',
    minQuantity: null,
    imageUrl: null,
    originCountry: null,
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
    originZone: null,
    recycledContentPercent: null,
    cautionComment: null,
    isEco: false,
    printable: false,
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: null,
  }
}

const meta = { total: 2, perPage: 12, currentPage: 1, lastPage: 1 }

describe('suppliers/index.vue', () => {
  it('affiche une carte par fournisseur + la barre de filtres', () => {
    const wrapper = mount(Index, {
      props: {
        suppliers: {
          data: [supplier('eurogoods', 'EuroGoods'), supplier('nordic', 'Nordic')],
          meta,
        },
        filters: { search: null, country: null },
        countries: ['FR', 'SE'],
      },
    })

    expect(wrapper.text()).toContain('EuroGoods')
    expect(wrapper.text()).toContain('Nordic')
    expect(wrapper.find('#search').exists()).toBe(true)
    expect(wrapper.find('#country').findAll('option')).toHaveLength(3)
  })

  it('affiche un état vide', () => {
    const wrapper = mount(Index, {
      props: {
        suppliers: { data: [], meta: { ...meta, total: 0 } },
        filters: { search: null, country: null },
        countries: [],
      },
    })
    expect(wrapper.text()).toContain('Aucun fournisseur.')
  })
})

describe('suppliers/show.vue', () => {
  const products = [product()]

  it('affiche le profil quand il existe + le catalogue', () => {
    const wrapper = mount(Show, {
      props: {
        supplier: {
          ...supplier('eurogoods', 'EuroGoods'),
          supplierProfile: {
            id: 1,
            organizationId: 1,
            minOrderQuantity: 50,
            deliveryDays: 10,
            deliveryScope: 'europe',
            certifications: ['ISO 9001'],
            bio: 'Bonjour',
            responseTimeDays: 2,
            companyType: null,
            deliveryCountries: null,
            spokenLanguages: null,
            minOrderNote: null,
            quoteEmail: null,
            reportFrequency: 'none' as const,
            catalogueUpdateMode: null,
            catalogueUpdateFrequency: null,
            defaultOriginScope: null,
            isFoundingPartner: false,
            foundingPartnerUntil: null,
            createdAt: '2026-07-10T00:00:00.000Z',
            updatedAt: null,
          },
          products,
          documents: [
            {
              id: 1,
              kind: 'catalogue',
              originalName: 'catalogue-2026.pdf',
              sizeBytes: 1572864,
              url: 'https://cellar.test/catalogue.pdf',
            },
          ],
        },
      },
    })

    expect(wrapper.text()).toContain('Profil fournisseur')
    expect(wrapper.text()).toContain('Europe')
    expect(wrapper.text()).toContain('ISO 9001')
    expect(wrapper.text()).toContain('Crayon')
    expect(wrapper.text()).toContain('Documents')
    expect(wrapper.text()).toContain('catalogue-2026.pdf')
    expect(wrapper.text()).toContain('1.5 MB')
    expect(wrapper.find('a[href="https://cellar.test/catalogue.pdf"]').exists()).toBe(true)
  })

  it('masque le profil pour un fournisseur non lié', () => {
    const wrapper = mount(Show, {
      props: {
        supplier: {
          ...supplier('nordic', 'Nordic'),
          supplierProfile: null,
          products: [],
          documents: [],
        },
      },
    })

    expect(wrapper.text()).not.toContain('Profil fournisseur')
    expect(wrapper.text()).toContain('Aucun produit.')
    expect(wrapper.text()).not.toContain('Documents')
  })
})

describe('product_card.vue', () => {
  it('formate une fourchette de prix', () => {
    const wrapper = mount(ProductCard, { props: { product: product() } })
    expect(wrapper.text()).toContain('1.50 – 2.00 EUR')
  })
})
