import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SearchInsightsFilters, SearchInsightsSummary } from '#shared/types/search_insights'

const translations = {
  'admin.search.empty': 'Aucune recherche.',
  'admin.search.noRows': 'Aucune donnée.',
  'admin.search.summary.total': 'Recherches',
  'admin.search.summary.zeroResults': 'Sans résultat',
  'admin.search.summary.zeroRate': '{rate} des recherches',
  'admin.search.summary.modes': 'Modes',
  'admin.search.summary.variation': '{percent} % vs précédente',
  'admin.search.summary.noPrevious': 'Pas de comparaison',
  'admin.search.modes.semantic': 'Sémantique',
  'admin.search.modes.keyword': 'Mots-clés',
  'admin.search.modes.unavailable': 'Indisponible',
  'admin.search.modes.browse': 'Navigation',
  'admin.search.filters.from': 'Du',
  'admin.search.filters.to': 'Au',
  'admin.search.filters.source': 'Source',
  'admin.search.filters.locale': 'Langue',
  'admin.search.filters.organizationType': 'Type',
  'admin.search.filters.all': 'Toutes',
  'admin.search.sources.catalogue': 'Catalogue',
  'admin.search.sources.suppliers': 'Fournisseurs',
  'admin.search.sources.rfq_lookup': 'Demandes',
  'admin.search.organizationTypes.buyer': 'Acheteur',
  'admin.search.organizationTypes.supplier': 'Fournisseur',
  'admin.search.organizationTypes.both': 'Les deux',
  'admin.search.chart.title': 'Par jour',
  'admin.search.chart.description': 'Total',
  'admin.search.chart.label': 'Du {from} au {to}',
  'admin.search.chart.point': '{date} : {total} dont {zero}',
  'admin.search.chart.total': 'Total',
  'admin.search.chart.zero': 'Sans résultat',
  'admin.search.columns.date': 'Date',
  'admin.search.columns.query': 'Requête',
  'admin.search.columns.searches': 'Recherches',
  'admin.search.columns.zeroCount': 'Sans résultat',
  'admin.search.columns.avgResults': 'Résultats',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations), Head: m.HeadStub }
})

const { default: SearchFilters } = await import('~/components/admin/search/search_filters.vue')
const { default: SearchSummary } = await import('~/components/admin/search/search_summary.vue')
const { default: SearchDailyChart } =
  await import('~/components/admin/search/search_daily_chart.vue')
const { default: SearchQueriesTable } =
  await import('~/components/admin/search/search_queries_table.vue')
const { variationPercent, withSearchParams } = await import('~/composables/use_search_insights')

const FILTERS: SearchInsightsFilters = {
  from: '2026-10-01',
  to: '2026-10-31',
  source: null,
  locale: null,
  organizationType: null,
}

function summary(extra: Partial<SearchInsightsSummary> = {}): SearchInsightsSummary {
  return {
    total: 150,
    zeroResults: 30,
    zeroRate: 0.2,
    byMode: { semantic: 100, keyword: 40, unavailable: 0, browse: 10 },
    previousTotal: 100,
    ...extra,
  }
}

describe('search_filters', () => {
  it('émet le filtre complet quand la source change', async () => {
    const wrapper = mount(SearchFilters, { props: { filters: FILTERS } })

    await wrapper.find('#search-source').setValue('suppliers')

    const events = wrapper.emitted('change') ?? []
    expect(events.at(-1)?.[0]).toEqual({ ...FILTERS, source: 'suppliers' })
  })

  it('émet la nouvelle date de début', async () => {
    const wrapper = mount(SearchFilters, { props: { filters: FILTERS } })

    await wrapper.find('#search-from').setValue('2026-10-10')

    expect((wrapper.emitted('change') ?? []).at(-1)?.[0]).toEqual({
      ...FILTERS,
      from: '2026-10-10',
    })
  })
})

describe('search_summary', () => {
  it('affiche le total, le taux sans résultat et la hausse vs période précédente', () => {
    const text = mount(SearchSummary, { props: { summary: summary() } }).text()

    expect(text).toContain('150')
    expect(text).toContain('+50 % vs précédente')
    expect(text).toContain('20')
    expect(text).toContain('des recherches')
    expect(text).toContain('Sémantique')
  })

  it('signale l’absence de période précédente', () => {
    const text = mount(SearchSummary, { props: { summary: summary({ previousTotal: 0 }) } }).text()

    expect(text).toContain('Pas de comparaison')
  })
})

describe('search_daily_chart', () => {
  it('expose une image nommée et un tableau alternatif', () => {
    const wrapper = mount(SearchDailyChart, {
      props: {
        daily: [
          { date: '2026-10-01', total: 10, zeroResults: 2 },
          { date: '2026-10-02', total: 5, zeroResults: 0 },
        ],
      },
    })

    const svg = wrapper.find('svg')
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe('Du 2026-10-01 au 2026-10-02')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })
})

describe('search_queries_table', () => {
  it('affiche l’état vide sans tableau', () => {
    const wrapper = mount(SearchQueriesTable, {
      props: { title: 'Top', description: 'desc', rows: [] },
    })

    expect(wrapper.text()).toContain('Aucune donnée.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('liste les requêtes', () => {
    const wrapper = mount(SearchQueriesTable, {
      props: {
        title: 'Top',
        description: 'desc',
        rows: [{ query: 'stylo', count: 12, zeroCount: 3, avgResults: 8 }],
        showZeroCount: true,
      },
    })

    expect(wrapper.find('tbody tr').text()).toContain('stylo')
  })
})

describe('use_search_insights', () => {
  it('calcule la variation et omet les filtres vides de l’export', () => {
    expect(variationPercent(50, 100)).toBe(-50)
    expect(variationPercent(10, 0)).toBeNull()
    expect(withSearchParams('/fr/admin/search/export', { ...FILTERS, source: 'catalogue' })).toBe(
      '/fr/admin/search/export?from=2026-10-01&to=2026-10-31&source=catalogue'
    )
  })
})
