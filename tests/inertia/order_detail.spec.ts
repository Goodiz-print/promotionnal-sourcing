import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, mountConfirmHost } from './support/confirm_dialog'
import type { OrderAction, OrderTimelineType, OrderType } from '#shared/types/order'

const translations = {
  'order.actions.confirm': 'Confirmer la commande',
  'order.actions.ship': 'Marquer comme expédiée',
  'order.actions.deliver': 'Confirmer la réception',
  'order.actions.cancel': 'Annuler la commande',
  'order.confirm.confirm': 'Confirmer ?',
  'order.confirm.cancel': 'Annuler ?',
  'order.timeline.created': 'Commande créée',
  'order.timeline.confirmed': 'Confirmée',
  'order.timeline.inProduction': 'En production',
  'order.timeline.shipped': 'Expédiée',
  'order.timeline.delivered': 'Livrée',
  'order.timeline.cancelled': 'Annulée',
  'order.timeline.pending': 'En attente',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { patch: vi.fn() },
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: { id?: number }) => `/fr/${name}/${params.id}`,
}))

const { default: OrderActions } = await import('~/components/orders/order_actions.vue')
const { default: OrderTimeline } = await import('~/components/orders/order_timeline.vue')
const { router } = await import('@inertiajs/vue3')

function order(actions: OrderAction[]): OrderType {
  return {
    id: 7,
    quoteId: 3,
    rfqId: 2,
    rfqTitle: 'Tote bags',
    status: 'pending',
    buyerName: 'Acme',
    supplierName: 'Fournisseur',
    shippingAddress: null,
    billingAddress: null,
    totalAmount: 100,
    currency: 'EUR',
    timeline: { createdAt: '2026-10-25T08:00:00.000Z' } as OrderTimelineType,
    actions,
    items: [],
  }
}

beforeEach(() => {
  vi.mocked(router.patch).mockReset()
})

describe('order_actions.vue', () => {
  it('n’affiche que les actions ouvertes par le serveur', () => {
    const wrapper = mount(OrderActions, {
      props: { order: order(['confirm', 'cancel']), side: 'supplier' },
    })

    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      'Confirmer la commande',
      'Annuler la commande',
    ])
  })

  it('ne rend rien sans action', () => {
    const wrapper = mount(OrderActions, { props: { order: order([]), side: 'buyer' } })

    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('appelle la route du côté après confirmation', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(OrderActions, { props: { order: order(['confirm']), side: 'supplier' } })

    await wrapper.find('button').trigger('click')
    expect(host.find('#confirm-dialog-message').text()).toBe('Confirmer ?')
    expect(host.find('[data-confirm-dialog="confirm"]').text()).toBe('Confirmer la commande')
    await answerConfirm(host, 'confirm')

    expect(router.patch).toHaveBeenCalledWith(
      '/fr/supplier.orders.confirm/7',
      {},
      { preserveScroll: true }
    )
  })

  it('n’envoie rien si l’utilisateur refuse la confirmation', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(OrderActions, { props: { order: order(['cancel']), side: 'buyer' } })

    await wrapper.find('button').trigger('click')
    expect(host.find('[data-confirm-dialog="confirm"]').classes()).toContain('text-danger')
    await answerConfirm(host, 'cancel')

    expect(router.patch).not.toHaveBeenCalled()
  })

  it('utilise la route acheteur pour la réception', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(OrderActions, { props: { order: order(['deliver']), side: 'buyer' } })

    await wrapper.find('button').trigger('click')
    await answerConfirm(host, 'confirm')

    expect(router.patch).toHaveBeenCalledWith('/fr/orders.deliver/7', {}, { preserveScroll: true })
  })
})

describe('order_timeline.vue', () => {
  const base: OrderTimelineType = {
    createdAt: '2026-10-25T08:00:00.000Z',
    confirmedAt: null,
    inProductionAt: null,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
  }

  it('liste toutes les étapes, celles non atteintes restent en attente', () => {
    const wrapper = mount(OrderTimeline, {
      props: { timeline: { ...base, confirmedAt: '2026-10-26T09:00:00.000Z' } },
    })

    expect(wrapper.findAll('li')).toHaveLength(5)
    expect(wrapper.findAll('li').filter((li) => li.text().includes('En attente'))).toHaveLength(3)
  })

  it('réduit une commande annulée à sa création et son annulation', () => {
    const wrapper = mount(OrderTimeline, {
      props: { timeline: { ...base, cancelledAt: '2026-10-26T09:00:00.000Z' } },
    })

    expect(wrapper.findAll('li').map((li) => li.text().split('\n')[0])).toEqual([
      expect.stringContaining('Commande créée'),
      expect.stringContaining('Annulée'),
    ])
    expect(wrapper.text()).not.toContain('En attente')
  })
})
