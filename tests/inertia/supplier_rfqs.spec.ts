import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SupplierRfqDetailType, SupplierRfqType } from '#shared/types/rfq'

const translations = {
  'rfq.supplier.index.title': 'Demandes reçues',
  'rfq.supplier.index.subtitle': 'Sous-titre',
  'rfq.supplier.index.empty': 'Aucune demande reçue pour le moment.',
  'rfq.supplier.index.from': 'De {name}',
  'rfq.supplier.index.receivedAt': 'Reçue le {date}',
  'rfq.supplier.show.backToList': 'Retour aux demandes reçues',
  'rfq.supplier.show.needTitle': 'Le besoin',
  'rfq.supplier.show.buyer': 'Acheteur',
  'rfq.supplier.show.noDeadline': 'Sans échéance',
  'rfq.supplier.show.declinedNotice': 'Vous avez décliné cette demande.',
  'rfq.supplier.show.closedNotice': "L'acheteur a clôturé cette demande.",
  'rfq.supplier.show.quoteSoon': 'Le dépôt de devis arrive prochainement.',
  'rfq.supplier.actions.decline': 'Décliner la demande',
  'rfq.supplier.actions.confirmDecline': 'Décliner cette demande ?',
  'rfq.supplier.status.sent': 'À traiter',
  'rfq.supplier.status.viewed': 'En cours',
  'rfq.supplier.status.responded': 'Devis envoyé',
  'rfq.supplier.status.declined': 'Déclinée',
  'rfq.index.itemCount': '{count} lignes',
  'rfq.show.deadline': 'Échéance : {date}',
  'rfq.show.category': 'Catégorie',
  'rfq.show.product': 'Produit',
}

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({ props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations } }),
  router: { post: vi.fn() },
  Head: { render: () => null },
}))
vi.mock('~/client', () => ({ urlFor: () => '/fr/supplier/rfqs/1/decline' }))
vi.mock('@adonisjs/inertia/vue', () => ({ Link: { template: '<a><slot /></a>' } }))

const { default: SupplierRfqsIndex } = await import('~/pages/supplier/rfqs/index.vue')
const { default: SupplierRfqShow } = await import('~/pages/supplier/rfqs/show.vue')
const { router } = await import('@inertiajs/vue3')

function rfq(overrides: Partial<SupplierRfqType> = {}): SupplierRfqType {
  return {
    id: 1,
    title: 'Tote bags coton bio',
    status: 'published',
    deadline: null,
    itemCount: 2,
    buyerName: 'Acme',
    buyerLogoUrl: null,
    myStatus: 'sent',
    sentAt: '2026-08-20T00:00:00.000Z',
    publishedAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  }
}

function detail(overrides: Partial<SupplierRfqDetailType> = {}): SupplierRfqDetailType {
  return {
    ...rfq(),
    description: null,
    items: [
      {
        id: 1,
        name: 'Tote bag 240g',
        description: null,
        quantity: 500,
        unit: 'pièce',
        categoryId: null,
        categoryName: null,
        productId: null,
        productName: null,
        specs: null,
      },
    ],
    ...overrides,
  }
}

describe('supplier/rfqs/index.vue', () => {
  it('liste les demandes reçues avec leur acheteur et leur statut', () => {
    const wrapper = mount(SupplierRfqsIndex, {
      props: {
        rfqs: [rfq(), rfq({ id: 2, title: 'Gourdes inox', myStatus: 'declined' })],
      },
    })

    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(wrapper.text()).toContain('De Acme')
    expect(wrapper.text()).toContain('À traiter')
    expect(wrapper.text()).toContain('Déclinée')
  })

  it('affiche un message quand aucune demande n’a été reçue', () => {
    const wrapper = mount(SupplierRfqsIndex, { props: { rfqs: [] } })

    expect(wrapper.text()).toContain('Aucune demande reçue pour le moment.')
    expect(wrapper.findAll('li')).toHaveLength(0)
  })
})

describe('supplier/rfqs/show.vue', () => {
  it('propose de décliner une demande reçue et non encore tranchée', () => {
    const wrapper = mount(SupplierRfqShow, { props: { rfq: detail() } })

    expect(wrapper.text()).toContain('Décliner la demande')
    expect(wrapper.text()).toContain('Tote bag 240g')
  })

  it('n’expose pas le budget de l’acheteur', () => {
    const wrapper = mount(SupplierRfqShow, { props: { rfq: detail() } })

    expect(wrapper.text()).not.toContain('4500')
    expect(wrapper.text()).not.toContain('Budget')
  })

  it('remplace l’action par un rappel une fois la demande déclinée', () => {
    const wrapper = mount(SupplierRfqShow, { props: { rfq: detail({ myStatus: 'declined' }) } })

    expect(wrapper.text()).toContain('Vous avez décliné cette demande.')
    expect(wrapper.text()).not.toContain('Décliner la demande')
  })

  it('n’offre plus de décliner une demande clôturée par l’acheteur', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: { rfq: detail({ status: 'closed', myStatus: 'viewed' }) },
    })

    expect(wrapper.text()).toContain("L'acheteur a clôturé cette demande.")
    expect(wrapper.text()).not.toContain('Décliner la demande')
  })

  it('demande confirmation avant de décliner', async () => {
    // `window.confirm` n'existe pas dans l'environnement de test : on le pose
    // plutôt que de l'espionner.
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    const wrapper = mount(SupplierRfqShow, { props: { rfq: detail() } })
    const button = wrapper.findAll('button').find((b) => b.text() === 'Décliner la demande')!

    await button.trigger('click')
    expect(confirm).toHaveBeenCalled()
    expect(router.post).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await button.trigger('click')
    expect(router.post).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})
