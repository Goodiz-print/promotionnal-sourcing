import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, mountConfirmHost } from './support/confirm_dialog'
import type {
  AdminOrderRow,
  AdminQuoteRow,
  AdminRfqDetail,
  AdminRfqRow,
} from '#shared/types/admin_trade'

const translations = {
  'admin.rfqs.title': 'Demandes de devis',
  'admin.rfqs.empty': 'Aucune demande.',
  'admin.rfqs.attention.overdue': 'Échéance dépassée',
  'admin.rfqs.attention.no_response': 'Sans réponse',
  'admin.rfqs.actions.close': 'Clôturer',
  'admin.rfqs.actions.expire': 'Faire expirer',
  'admin.rfqs.actions.remind': 'Relancer',
  'admin.rfqs.actions.confirmClose': 'Clôturer ?',
  'admin.quotes.title': 'Devis',
  'admin.quotes.number': 'Devis n° {id}',
  'admin.orders.title': 'Commandes',
  'admin.orders.number': 'Commande n° {id}',
  'admin.trade.filters.status': 'Statut',
  'admin.trade.filters.buyer': 'Acheteur',
  'admin.trade.filters.apply': 'Filtrer',
  'rfq.status.published': 'Publiée',
  'rfq.status.closed': 'Clôturée',
  'quote.status.submitted': 'Remis',
  'order.status.confirmed': 'Confirmée',
  'rfq.supplierStatus.sent': 'Envoyée',
}

const state = { role: 'admin' }
const get = vi.fn()
const post = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => ({
      ...m.inertiaPage(translations),
      props: { ...m.inertiaPage(translations).props, user: { platformRole: state.role } },
    }),
    router: {
      get: (...args: unknown[]) => get(...args),
      post: (...args: unknown[]) => post(...args),
    },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: { id?: number }) =>
    `/fr/${name}${params.id ? `/${params.id}` : ''}`,
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: RfqIndex } = await import('~/pages/admin/rfqs/index.vue')
const { default: RfqShow } = await import('~/pages/admin/rfqs/show.vue')
const { default: QuoteIndex } = await import('~/pages/admin/quotes/index.vue')
const { default: OrderIndex } = await import('~/pages/admin/orders/index.vue')

const META = { total: 2, perPage: 25, currentPage: 1, lastPage: 1 }
const FILTERS = { buyer: null, supplier: null, from: null, to: null }
const party = (id: number, name: string) => ({ id, name })

function rfq(id: number, extra: Partial<AdminRfqRow> = {}): AdminRfqRow {
  return {
    id,
    title: `Demande ${id}`,
    status: 'published',
    buyer: party(1, 'Acme'),
    deadline: '2026-11-30T10:00:00.000Z',
    publishedAt: '2026-10-30T10:00:00.000Z',
    createdAt: '2026-10-29T10:00:00.000Z',
    suppliersCount: 3,
    respondedCount: 1,
    quotesCount: 1,
    attention: null,
    ...extra,
  }
}

function detail(extra: Partial<AdminRfqDetail> = {}): AdminRfqDetail {
  return {
    item: rfq(5),
    description: null,
    budgetMax: null,
    createdByEmail: 'buyer@example.com',
    items: [{ id: 1, name: 'Gourde', quantity: 100, unit: null, description: null }],
    recipients: [
      {
        id: 1,
        supplier: party(9, 'Fournisseur Sud'),
        status: 'sent',
        sentAt: '2026-10-30T10:00:00.000Z',
        remindedAt: null,
      },
    ],
    quotes: [],
    canClose: true,
    canExpire: true,
    remindableCount: 2,
    ...extra,
  }
}

describe('admin/rfqs/index', () => {
  beforeEach(() => get.mockClear())

  it('liste les demandes avec leur statut et le badge à surveiller', () => {
    const wrapper = mount(RfqIndex, {
      props: {
        rfqs: { data: [rfq(1), rfq(2, { attention: 'overdue' })], meta: META },
        filters: { ...FILTERS, status: null, attention: null },
      },
    })
    const rows = wrapper.findAll('tbody tr')

    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Demande 1')
    expect(rows[0].text()).toContain('Acme')
    expect(rows[0].text()).toContain('Publiée')
    expect(rows[0].text()).not.toContain('Échéance dépassée')
    expect(rows[1].text()).toContain('Échéance dépassée')
  })

  it('affiche l’état vide sans tableau', () => {
    const wrapper = mount(RfqIndex, {
      props: {
        rfqs: { data: [], meta: { ...META, total: 0 } },
        filters: { ...FILTERS, status: null, attention: null },
      },
    })

    expect(wrapper.text()).toContain('Aucune demande.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('filtrer relance la visite avec les filtres actifs, à la page 1', async () => {
    const wrapper = mount(RfqIndex, {
      props: {
        rfqs: { data: [rfq(1)], meta: META },
        filters: { ...FILTERS, status: null, attention: null },
      },
    })

    await wrapper.find('#trade-status').setValue('published')
    await wrapper.find('#trade-buyer').setValue('Acme')
    await wrapper.find('form').trigger('submit')

    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0][1]).toEqual({ status: 'published', buyer: 'Acme', page: 1 })
  })
})

describe('filtres synchronisés avec le serveur', () => {
  it('les champs suivent les filtres reçus (retour arrière, lien externe)', async () => {
    const wrapper = mount(RfqIndex, {
      props: {
        rfqs: { data: [rfq(1)], meta: META },
        filters: { ...FILTERS, status: null, attention: null, buyer: 'Acme' },
      },
    })
    expect((wrapper.find('#trade-buyer').element as HTMLInputElement).value).toBe('Acme')

    await wrapper.setProps({
      filters: { ...FILTERS, status: null, attention: null, buyer: 'Beta' },
    })

    expect((wrapper.find('#trade-buyer').element as HTMLInputElement).value).toBe('Beta')
  })
})

describe('admin/rfqs/show', () => {
  beforeEach(() => {
    state.role = 'admin'
    post.mockClear()
  })

  const show = (extra: Partial<AdminRfqDetail> = {}) =>
    mount(RfqShow, { props: { detail: detail(extra) } })
  const labels = (wrapper: ReturnType<typeof show>) =>
    wrapper.findAll('button').map((button) => button.text())

  it('propose les trois interventions à un admin', () => {
    const wrapper = show()

    expect(labels(wrapper)).toEqual(['Relancer', 'Faire expirer', 'Clôturer'])
    expect(wrapper.text()).toContain('Fournisseur Sud')
  })

  it('clôturer confirme puis poste vers la route de clôture', async () => {
    const host = await mountConfirmHost()
    const wrapper = show()

    await wrapper.findAll('button')[2].trigger('click')

    expect(host.find('[data-confirm-dialog="message"]').text()).toBe('Clôturer ?')
    expect(host.find('[data-confirm-dialog="confirm"]').text()).toBe('Clôturer')
    expect(host.find('[data-confirm-dialog="confirm"]').classes()).toContain('text-danger')
    expect(post).not.toHaveBeenCalled()
    await answerConfirm(host, 'confirm')
    expect(post).toHaveBeenCalledWith(
      '/fr/admin.rfqs.close/5',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('désactive les boutons pendant l’envoi pour éviter un double clic', async () => {
    const host = await mountConfirmHost()
    const wrapper = show()

    await wrapper.findAll('button')[2].trigger('click')
    await answerConfirm(host, 'confirm')
    const options = post.mock.calls[0][2] as { onStart: () => void; onFinish: () => void }
    options.onStart()
    await wrapper.vm.$nextTick()
    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined)
    ).toBe(true)

    options.onFinish()
    await wrapper.vm.$nextTick()
    expect(
      wrapper.findAll('button').some((button) => button.attributes('disabled') !== undefined)
    ).toBe(false)
  })

  it('ne poste rien si la confirmation est refusée', async () => {
    const host = await mountConfirmHost()

    await show().findAll('button')[2].trigger('click')
    await answerConfirm(host, 'cancel')

    expect(post).not.toHaveBeenCalled()
  })

  it.each(['support', 'analyst'])('masque les interventions pour le rôle %s', (role) => {
    state.role = role

    expect(labels(show())).toEqual([])
  })

  it('masque les interventions impossibles dans l’état courant', () => {
    const wrapper = show({ canClose: false, canExpire: true, remindableCount: 0 })

    expect(labels(wrapper)).toEqual(['Faire expirer'])
    expect(labels(show({ canClose: false, canExpire: false, remindableCount: 0 }))).toEqual([])
  })
})

describe('admin/quotes et orders (index)', () => {
  it('liste les devis avec acheteur, fournisseur, statut et montant formaté', () => {
    const row: AdminQuoteRow = {
      id: 7,
      rfqId: 1,
      rfqTitle: 'Demande 1',
      status: 'submitted',
      buyer: party(1, 'Acme'),
      supplier: party(2, 'Sud'),
      totalAmount: '1250.50',
      currency: 'EUR',
      submittedAt: '2026-10-30T10:00:00.000Z',
      validUntil: null,
      createdAt: '2026-10-29T10:00:00.000Z',
    }
    const wrapper = mount(QuoteIndex, {
      props: { quotes: { data: [row], meta: META }, filters: { ...FILTERS, status: null } },
    })
    const text = wrapper.find('tbody tr').text()

    expect(text).toContain('Devis n° 7')
    expect(text).toContain('Acme')
    expect(text).toContain('Sud')
    expect(text).toContain('Remis')
    expect(text).toMatch(/1\s?250,50/)
  })

  it('liste les commandes', () => {
    const row: AdminOrderRow = {
      id: 3,
      quoteId: 7,
      status: 'confirmed',
      buyer: party(1, 'Acme'),
      supplier: party(2, 'Sud'),
      totalAmount: '99.00',
      currency: 'EUR',
      createdAt: '2026-10-30T10:00:00.000Z',
    }
    const wrapper = mount(OrderIndex, {
      props: { orders: { data: [row], meta: META }, filters: { ...FILTERS, status: null } },
    })
    const text = wrapper.find('tbody tr').text()

    expect(text).toContain('Commande n° 3')
    expect(text).toContain('Confirmée')
  })
})
