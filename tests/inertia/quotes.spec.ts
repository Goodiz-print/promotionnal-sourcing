import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { QuoteType } from '#shared/types/quote'
import type { RfqItemType } from '#shared/types/rfq'

const translations = {
  'quote.status.submitted': 'Remis',
  'quote.status.accepted': 'Accepté',
  'quote.status.rejected': 'Rejeté',
  'quote.status.expired': 'Expiré',
  'quote.table.item': 'Article',
  'quote.table.total': 'Total',
  'quote.table.days': '{count, plural, one {# jour} other {# jours}}',
  'quote.comparison.empty': 'Aucun devis reçu pour le moment.',
  'quote.comparison.notQuoted': 'Non chiffré',
  'quote.comparison.cheapest': 'Moins cher',
  'quote.comparison.fastest': 'Plus rapide',
  'quote.comparison.leadTime': 'Délai global',
  'quote.comparison.validUntil': "Valable jusqu'au",
  'quote.show.title': 'Devis de {supplierName}',
  'quote.show.backToRfq': 'Retour à « {rfqTitle} »',
  'quote.show.accept': 'Accepter ce devis',
  'quote.show.reject': 'Rejeter ce devis',
  'quote.show.confirm.accept': 'Accepter ?',
  'quote.show.confirm.reject': 'Rejeter ?',
  'quote.form.notes': "Notes pour l'acheteur",
  'quote.form.validUntilOn': "Valable jusqu'au {date}",
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { patch: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: () => '/fr/quotes/1/accept' }))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: QuoteComparisonTable } =
  await import('~/components/quotes/quote_comparison_table.vue')
const { default: QuoteShow } = await import('~/pages/quotes/show.vue')
const { router } = await import('@inertiajs/vue3')

const items: RfqItemType[] = [
  {
    id: 1,
    name: 'Tote bag',
    description: null,
    quantity: 500,
    unit: null,
    categoryId: null,
    categoryName: null,
    productId: null,
    productName: null,
    productSlug: null,
    specs: null,
  },
]

function quote(overrides: Partial<QuoteType> = {}): QuoteType {
  return {
    id: 1,
    rfqId: 9,
    rfqTitle: 'Tote bags',
    status: 'submitted',
    supplierOrganizationId: 3,
    supplierName: 'Textiles SA',
    validUntil: null,
    notes: null,
    totalAmount: 1000,
    currency: 'EUR',
    submittedAt: null,
    decidedAt: null,
    leadTimeDays: 20,
    items: [
      {
        id: 1,
        rfqItemId: 1,
        rfqItemName: 'Tote bag',
        productId: null,
        unitPrice: 2,
        quantity: 500,
        totalPrice: 1000,
        leadTimeDays: 20,
        customizationDetails: null,
      },
    ],
    ...overrides,
  }
}

describe('quotes/quote_comparison_table.vue', () => {
  it('annonce l’absence de devis', () => {
    const wrapper = mount(QuoteComparisonTable, { props: { quotes: [], items } })

    expect(wrapper.text()).toContain('Aucun devis reçu pour le moment.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('souligne le moins cher et le plus rapide parmi les devis en lice', () => {
    const cheap = quote({ id: 1, supplierName: 'Bon marché', totalAmount: 800, leadTimeDays: 30 })
    const fast = quote({ id: 2, supplierName: 'Express', totalAmount: 1200, leadTimeDays: 5 })

    const wrapper = mount(QuoteComparisonTable, { props: { quotes: [cheap, fast], items } })

    const [totalRow, leadRow] = wrapper.findAll('tfoot tr')
    expect(totalRow.findAll('td')[1].text()).toContain('Moins cher')
    expect(totalRow.findAll('td')[2].text()).not.toContain('Moins cher')
    expect(leadRow.findAll('td')[2].text()).toContain('Plus rapide')
    expect(leadRow.findAll('td')[1].text()).not.toContain('Plus rapide')
  })

  it('ne couronne personne quand un seul devis est en lice, ni un devis rejeté', () => {
    const rejected = quote({ id: 2, status: 'rejected', totalAmount: 100, leadTimeDays: 1 })
    const wrapper = mount(QuoteComparisonTable, {
      props: { quotes: [quote({ id: 1 }), rejected], items },
    })

    expect(wrapper.text()).not.toContain('Moins cher')
    expect(wrapper.text()).not.toContain('Plus rapide')
  })

  it('signale un item que le fournisseur n’a pas chiffré', () => {
    const partial = quote({ items: [] })

    const wrapper = mount(QuoteComparisonTable, { props: { quotes: [partial], items } })

    expect(wrapper.text()).toContain('Non chiffré')
  })
})

describe('quotes/show.vue', () => {
  it('propose d’accepter et de rejeter un devis remis', () => {
    const wrapper = mount(QuoteShow, { props: { quote: quote(), canDecide: true } })

    expect(wrapper.text()).toContain('Devis de Textiles SA')
    expect(wrapper.text()).toContain('Accepter ce devis')
    expect(wrapper.text()).toContain('Rejeter ce devis')
  })

  it('masque les décisions quand elles ne sont pas permises', () => {
    const wrapper = mount(QuoteShow, {
      props: { quote: quote({ status: 'accepted' }), canDecide: false },
    })

    expect(wrapper.text()).not.toContain('Accepter ce devis')
    expect(wrapper.text()).not.toContain('Rejeter ce devis')
  })

  it('demande confirmation avant d’accepter', async () => {
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    const wrapper = mount(QuoteShow, { props: { quote: quote(), canDecide: true } })
    const button = wrapper.findAll('button').find((b) => b.text() === 'Accepter ce devis')!

    await button.trigger('click')
    expect(confirm).toHaveBeenCalled()
    expect(router.patch).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await button.trigger('click')
    expect(router.patch).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})
