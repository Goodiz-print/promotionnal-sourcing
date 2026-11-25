import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SupplierSubscriptionPageProps } from '#shared/types/subscription'

const translations = {
  'subscription.plans.subscribe': 'Souscrire',
  'subscription.plans.change': 'Changer de formule',
  'subscription.current.manage': 'Gérer mon abonnement',
  'subscription.page.unavailable': 'Souscription en ligne indisponible',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return { usePage: () => m.inertiaPage(translations), router: { post: vi.fn() }, Head: m.HeadStub }
})
vi.mock('~/client', () => ({ urlFor: (route: string) => `/${route}` }))

const { default: SubscriptionPage } = await import('~/pages/supplier/subscription/show.vue')
const { router } = await import('@inertiajs/vue3')

beforeEach(() => vi.mocked(router.post).mockClear())

const FREE: SupplierSubscriptionPageProps = {
  currentPlan: 'free',
  subscription: null,
  onlineEnabled: true,
  portalAvailable: false,
  checkoutStatus: null,
}

function buttons(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').filter((button) => button.text().includes(label))
}

describe('supplier/subscription/show.vue', () => {
  it('propose de souscrire aux deux formules payantes et envoie la formule choisie', async () => {
    const wrapper = mount(SubscriptionPage, { props: FREE })

    const subscribe = buttons(wrapper, 'Souscrire')
    expect(subscribe).toHaveLength(2)

    await subscribe[1].trigger('click')
    expect(router.post).toHaveBeenCalledWith(
      '/supplier.subscription.checkout',
      { plan: 'premium' },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('un abonné en ligne change de formule et gère son abonnement via le portail', async () => {
    const wrapper = mount(SubscriptionPage, {
      props: {
        ...FREE,
        currentPlan: 'business',
        portalAvailable: true,
        subscription: {
          plan: 'business',
          status: 'active',
          origin: 'stripe',
          startsAt: '2026-11-01T00:00:00.000Z',
          endsAt: '2026-12-01T00:00:00.000Z',
          cancelAtPeriodEnd: false,
        },
      },
    })

    expect(buttons(wrapper, 'Souscrire')).toHaveLength(0)
    const change = buttons(wrapper, 'Changer de formule')
    expect(change).toHaveLength(1)
    expect(buttons(wrapper, 'Gérer mon abonnement')).toHaveLength(1)

    await change[0].trigger('click')
    expect(router.post).toHaveBeenCalledWith(
      '/supplier.subscription.portal',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('sans souscription en ligne, aucune action et un message', () => {
    const wrapper = mount(SubscriptionPage, { props: { ...FREE, onlineEnabled: false } })

    expect(buttons(wrapper, 'Souscrire')).toHaveLength(0)
    expect(wrapper.text()).toContain('Souscription en ligne indisponible')
  })
})
