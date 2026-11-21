import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { BuyerContactType, SupplierRfqDetailType, SupplierRfqType } from '#shared/types/rfq'

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
  'rfq.supplier.show.expiredNotice': 'Cette demande est échue.',
  'quote.supplier.rfq.respond': 'Répondre par un devis',
  'quote.supplier.rfq.viewQuote': 'Voir mon devis',
  'quote.status.draft': 'Brouillon',
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
  'rfq.supplier.anonymousBuyer': 'Agence anonyme',
  'subscription.upsell.title': 'Abonnez-vous pour connaître l’agence',
  'subscription.upsell.body': 'Abonnez-vous pour la contacter directement.',
  'subscription.upsell.askAdmin': 'Un administrateur peut abonner votre organisation.',
  'subscription.upsell.cta': 'Découvrir les abonnements',
  'rfq.supplier.show.contact.title': 'Coordonnées de l’agence',
  'rfq.supplier.show.contact.agency': 'Agence',
  'rfq.supplier.show.contact.requester': 'Demande faite par',
  'rfq.supplier.show.contact.email': 'E-mail',
  'rfq.supplier.show.contact.phone': 'Téléphone',
  'rfq.supplier.show.contact.address': 'Adresse',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { post: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: () => '/fr/supplier/rfqs/1/decline' }))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

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
        productSlug: null,
        specs: null,
      },
    ],
    buyerContact: null,
    ...overrides,
  }
}

const contact: BuyerContactType = {
  agencyName: 'Acme',
  requesterName: 'Alice Martin',
  email: 'contact@acme.test',
  phone: '+33 1 23 45 67 89',
  addressLines: ['12 rue des Lilas', '75011 Paris', 'France'],
}

describe('supplier/rfqs/index.vue', () => {
  it('liste les demandes reçues avec leur acheteur et leur statut', () => {
    const wrapper = mount(SupplierRfqsIndex, {
      props: {
        rfqs: [rfq(), rfq({ id: 2, title: 'Gourdes inox', myStatus: 'declined' })],
        upsell: null,
      },
    })

    // Une ligne de tableau par demande ; l'acheteur a sa propre colonne.
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Acme')
    expect(wrapper.text()).toContain('À traiter')
    expect(wrapper.text()).toContain('Déclinée')
    expect(wrapper.text()).not.toContain('Découvrir les abonnements')
  })

  it('masque l’agence et propose de s’abonner à un fournisseur non abonné', () => {
    const wrapper = mount(SupplierRfqsIndex, {
      props: { rfqs: [rfq({ buyerName: null })], upsell: { canSubscribe: true } },
    })

    expect(wrapper.text()).toContain('Agence anonyme')
    expect(wrapper.text()).toContain('Découvrir les abonnements')
  })

  it('renvoie vers un administrateur un membre qui ne peut pas souscrire', () => {
    const wrapper = mount(SupplierRfqsIndex, {
      props: { rfqs: [rfq({ buyerName: null })], upsell: { canSubscribe: false } },
    })

    expect(wrapper.text()).toContain('Un administrateur peut abonner votre organisation.')
    expect(wrapper.text()).not.toContain('Découvrir les abonnements')
  })

  it('affiche un message quand aucune demande n’a été reçue', () => {
    const wrapper = mount(SupplierRfqsIndex, { props: { rfqs: [], upsell: null } })

    expect(wrapper.text()).toContain('Aucune demande reçue pour le moment.')
    expect(wrapper.find('table').exists()).toBe(false)
  })
})

describe('supplier/rfqs/show.vue', () => {
  // Demande ouverte, sans devis encore : le fournisseur peut y répondre.
  const thread = {
    rfqSupplierId: 1,
    counterpartName: null,
    blocked: false,
    canWrite: true,
    messages: [],
  }
  const open = { quote: null, canQuote: true, upsell: null, thread }

  it('propose de décliner une demande reçue et non encore tranchée', () => {
    const wrapper = mount(SupplierRfqShow, { props: { ...open, rfq: detail() } })

    expect(wrapper.text()).toContain('Décliner la demande')
    expect(wrapper.text()).toContain('Tote bag 240g')
  })

  it('propose de répondre par un devis tant que la demande est ouverte', () => {
    const wrapper = mount(SupplierRfqShow, { props: { ...open, rfq: detail() } })

    expect(wrapper.text()).toContain('Répondre par un devis')
  })

  it('renvoie vers le devis existant au lieu d’en proposer un second', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: {
        rfq: detail(),
        canQuote: true,
        quote: { id: 7, status: 'draft' },
        upsell: null,
        thread,
      },
    })

    expect(wrapper.text()).toContain('Voir mon devis')
    expect(wrapper.text()).not.toContain('Répondre par un devis')
    // Un devis en cours : décliner n'a plus de sens.
    expect(wrapper.text()).not.toContain('Décliner la demande')
  })

  it('montre l’agence à un fournisseur abonné', () => {
    const wrapper = mount(SupplierRfqShow, { props: { ...open, rfq: detail() } })

    expect(wrapper.text()).toContain('De Acme')
    expect(wrapper.text()).not.toContain('Découvrir les abonnements')
  })

  it('remplace l’agence par l’encart d’abonnement pour un non abonné', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: { ...open, upsell: { canSubscribe: true }, rfq: detail({ buyerName: null }) },
    })

    expect(wrapper.text()).toContain('Agence anonyme')
    expect(wrapper.text()).toContain('Découvrir les abonnements')
    expect(wrapper.text()).not.toContain('Acme')
  })

  it('donne les coordonnées de l’agence à un fournisseur abonné', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: { ...open, rfq: detail({ buyerContact: contact }) },
    })

    expect(wrapper.text()).toContain('Coordonnées de l’agence')
    expect(wrapper.text()).toContain('Alice Martin')
    expect(wrapper.text()).toContain('12 rue des Lilas, 75011 Paris, France')
    expect(wrapper.find('a[href="mailto:contact@acme.test"]').exists()).toBe(true)
    expect(wrapper.find('a[href="tel:+33 1 23 45 67 89"]').exists()).toBe(true)
  })

  it('omet les coordonnées que l’agence n’a pas renseignées', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: {
        ...open,
        rfq: detail({
          buyerContact: { ...contact, requesterName: null, phone: null, addressLines: [] },
        }),
      },
    })

    expect(wrapper.find('[data-row="email"]').exists()).toBe(true)
    expect(wrapper.find('[data-row="phone"]').exists()).toBe(false)
    expect(wrapper.find('[data-row="requesterName"]').exists()).toBe(false)
    expect(wrapper.find('[data-row="addressLines"]').exists()).toBe(false)
  })

  it('n’affiche aucune coordonnée à un non abonné', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: { ...open, upsell: { canSubscribe: true }, rfq: detail({ buyerName: null }) },
    })

    expect(wrapper.text()).not.toContain('Coordonnées de l’agence')
  })

  it('n’expose pas le budget de l’acheteur', () => {
    const wrapper = mount(SupplierRfqShow, { props: { ...open, rfq: detail() } })

    expect(wrapper.text()).not.toContain('4500')
    expect(wrapper.text()).not.toContain('Budget')
  })

  it('remplace l’action par un rappel une fois la demande déclinée', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: { ...open, canQuote: false, rfq: detail({ myStatus: 'declined' }) },
    })

    expect(wrapper.text()).toContain('Vous avez décliné cette demande.')
    expect(wrapper.text()).not.toContain('Décliner la demande')
  })

  it('n’offre plus de décliner une demande clôturée par l’acheteur', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: { ...open, canQuote: false, rfq: detail({ status: 'closed', myStatus: 'viewed' }) },
    })

    expect(wrapper.text()).toContain("L'acheteur a clôturé cette demande.")
    expect(wrapper.text()).not.toContain('Décliner la demande')
  })

  it('signale une demande échue et ne propose plus de la décliner', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: { ...open, canQuote: false, rfq: detail({ status: 'expired', myStatus: 'viewed' }) },
    })

    expect(wrapper.text()).toContain('Cette demande est échue.')
    expect(wrapper.text()).not.toContain('Décliner')
  })

  it('demande confirmation avant de décliner', async () => {
    // `window.confirm` n'existe pas dans l'environnement de test : on le pose
    // plutôt que de l'espionner.
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    const wrapper = mount(SupplierRfqShow, { props: { ...open, rfq: detail() } })
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
