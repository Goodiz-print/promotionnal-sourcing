import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SupplierInsightsPageProps } from '#shared/types/supplier_insights'

const translations = {
  'supplier.insights.title': 'Consultations',
  'supplier.insights.subtitle': 'Sous-titre',
  'supplier.insights.period': 'Période',
  'supplier.insights.periodOption': '{days} derniers jours',
  'supplier.insights.summary.productViews': 'Consultations de produits',
  'supplier.insights.products.title': 'Consultations par produit',
  'supplier.insights.products.emptyTitle': 'Aucun produit',
  'supplier.insights.products.next': 'Suivant',
  'supplier.insights.agencies.title': 'Agences qui vous ont consulté',
  'supplier.insights.agencies.emptyTitle': 'Aucune agence sur la période',
  'supplier.insights.agencies.limited':
    'Seules les {count} agences les plus récentes sont affichées.',
  'subscription.upsell.title': 'Abonnez-vous pour connaître l’agence',
  'subscription.upsell.body': 'Abonnez-vous.',
  'subscription.upsell.askAdmin': 'Demandez à un administrateur.',
  'subscription.upsell.cta': 'Découvrir les abonnements',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations), router: { get: vi.fn() }, Head: m.HeadStub }
})
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})
vi.mock('~/client', () => ({ urlFor: (route: string) => `/${route}` }))

const { default: InsightsPage } = await import('~/pages/supplier/insights/index.vue')
const { default: InsightsAgencies } =
  await import('~/components/supplier/insights/insights_agencies.vue')
const { default: InsightsProductsTable } =
  await import('~/components/supplier/insights/insights_products_table.vue')
const { router } = await import('@inertiajs/vue3')

beforeEach(() => vi.mocked(router.get).mockClear())

const META = { total: 1, perPage: 50, currentPage: 1, lastPage: 1 }

function props(overrides: Partial<SupplierInsightsPageProps['report']> = {}) {
  return {
    period: 30,
    report: {
      range: { from: '2026-10-26', to: '2026-11-24' },
      summary: { productViews: 12, supplierViews: 3, rfqAdditions: 2, viewedProducts: 4 },
      products: {
        data: [{ productId: 7, name: 'Gourde inox', views: 12, rfqAdditions: 2 }],
        meta: META,
      },
      agencies: null,
      ...overrides,
    },
    upsell: { canSubscribe: true },
  } satisfies SupplierInsightsPageProps
}

describe('supplier/insights/index.vue', () => {
  it('affiche les compteurs et les produits, et l’encart pour un non abonné', () => {
    const wrapper = mount(InsightsPage, { props: props() })

    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('Gourde inox')
    expect(wrapper.text()).toContain('Abonnez-vous pour connaître l’agence')
    expect(wrapper.text()).not.toContain('Agences qui vous ont consulté')
  })

  it('un abonné voit la liste des agences à la place de l’encart', () => {
    const wrapper = mount(InsightsPage, {
      props: {
        ...props({
          agencies: [
            { name: 'Agence Lune', views: 3, products: 2, lastViewedAt: '2026-11-20T10:00:00Z' },
          ],
        }),
        upsell: null,
      },
    })

    expect(wrapper.text()).toContain('Agence Lune')
    expect(wrapper.text()).toContain('20/11/2026')
    expect(wrapper.text()).not.toContain('Abonnez-vous pour connaître l’agence')
  })

  it('changer de période relance la visite avec la période choisie', async () => {
    const wrapper = mount(InsightsPage, { props: props() })

    await wrapper.find('select').setValue('90')

    expect(router.get).toHaveBeenCalledWith(
      '/supplier.insights.index',
      { period: 90, page: undefined },
      expect.objectContaining({ preserveScroll: true, only: ['period', 'report', 'upsell'] })
    )
  })

  it('changer de page garde la période', async () => {
    const wrapper = mount(InsightsPage, {
      props: props({
        products: {
          data: [{ productId: 7, name: 'Gourde inox', views: 12, rfqAdditions: 2 }],
          meta: { total: 60, perPage: 50, currentPage: 1, lastPage: 2 },
        },
      }),
    })

    const next = wrapper.findAll('button').find((button) => button.text().includes('Suivant'))
    await next!.trigger('click')

    expect(router.get).toHaveBeenCalledWith(
      '/supplier.insights.index',
      { period: 30, page: 2 },
      expect.anything()
    )
  })
})

describe('composants « Consultations »', () => {
  it('le tableau des produits affiche un état vide sans produit', () => {
    const wrapper = mount(InsightsProductsTable, {
      props: { products: { data: [], meta: { ...META, total: 0 } } },
    })
    expect(wrapper.text()).toContain('Aucun produit')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('la liste des agences affiche un état vide', () => {
    const wrapper = mount(InsightsAgencies, { props: { agencies: [] } })
    expect(wrapper.text()).toContain('Aucune agence sur la période')
  })

  it('la liste des agences signale le plafond quand il est atteint', () => {
    const agency = { name: 'Agence', views: 1, products: 1, lastViewedAt: '2026-11-20T10:00:00Z' }
    const full = mount(InsightsAgencies, {
      props: { agencies: Array.from({ length: 100 }, () => agency) },
    })
    const short = mount(InsightsAgencies, { props: { agencies: [agency] } })

    expect(full.text()).toContain('Seules les 100 agences les plus récentes sont affichées.')
    expect(short.text()).not.toContain('Seules les')
  })
})
