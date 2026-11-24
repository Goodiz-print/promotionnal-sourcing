import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { BuyerContactType, SupplierRfqDetailType, SupplierRfqType } from '#shared/types/rfq'

const formPost = vi.hoisted(() => vi.fn())

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
  'rfq.supplier.status.expired': 'Expirée',
  'rfq.supplier.state.to_process': 'À traiter',
  'rfq.supplier.state.responded': 'Répondu',
  'rfq.supplier.state.expired': 'Expiré',
  'rfq.supplier.state.declined': 'Décliné',
  'rfq.supplier.index.filters.label': 'Filtrer les demandes reçues',
  'rfq.supplier.index.filters.status': 'Statut',
  'rfq.supplier.index.filters.allStatuses': 'Tous les statuts',
  'rfq.supplier.index.filters.reset': 'Réinitialiser le filtre',
  'rfq.supplier.index.emptyFiltered': 'Aucune demande pour ce statut.',
  'quote.supplier.documents.title': 'Devis envoyé',
  'quote.supplier.documents.description': 'Votre devis PDF.',
  'quote.supplier.documents.empty': 'Aucun devis PDF envoyé pour le moment.',
  'quote.supplier.documents.columns.file': 'Fichier',
  'quote.supplier.documents.columns.sentAt': 'Envoyé le',
  'quote.supplier.documents.columns.channel': 'Envoi',
  'quote.supplier.documents.channel.mail': 'Par mail',
  'quote.supplier.documents.channel.upload': 'Depuis la plateforme',
  'quote.supplier.documents.download': 'Télécharger {filename}',
  'quote.supplier.documents.upload.file': 'Votre devis (PDF)',
  'quote.supplier.documents.upload.submit': 'Envoyer le devis',
  'quote.supplier.documents.upload.body': 'Message à l’agence (facultatif)',
  'rfq.lateReply': 'Réponse tardive',
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
  'rfq.supplier.show.responseOpen': 'Chiffrez ce besoin.',
  'rfq.supplier.show.responseDocument': 'Vous avez envoyé un devis PDF pour cette demande.',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm({ post: formPost }),
    router: { post: vi.fn(), get: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: Record<string, unknown> = {}) => `${name}:${params.id ?? ''}`,
}))
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
    myState: 'to_process',
    myLateReply: false,
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

const noFilter = { status: null }

describe('supplier/rfqs/index.vue', () => {
  it('liste les demandes reçues avec leur acheteur et leur statut', () => {
    const wrapper = mount(SupplierRfqsIndex, {
      props: {
        rfqs: [
          rfq(),
          rfq({ id: 2, title: 'Gourdes inox', myStatus: 'declined', myState: 'declined' }),
        ],
        upsell: null,
        filters: noFilter,
      },
    })

    // Une ligne de tableau par demande ; l'acheteur a sa propre colonne.
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Acme')
    expect(wrapper.text()).toContain('À traiter')
    expect(wrapper.text()).toContain('Décliné')
    expect(wrapper.text()).not.toContain('Découvrir les abonnements')
  })

  it('masque l’agence et propose de s’abonner à un fournisseur non abonné', () => {
    const wrapper = mount(SupplierRfqsIndex, {
      props: {
        rfqs: [rfq({ buyerName: null })],
        upsell: { canSubscribe: true },
        filters: noFilter,
      },
    })

    expect(wrapper.text()).toContain('Agence anonyme')
    expect(wrapper.text()).toContain('Découvrir les abonnements')
  })

  it('renvoie vers un administrateur un membre qui ne peut pas souscrire', () => {
    const wrapper = mount(SupplierRfqsIndex, {
      props: {
        rfqs: [rfq({ buyerName: null })],
        upsell: { canSubscribe: false },
        filters: noFilter,
      },
    })

    expect(wrapper.text()).toContain('Un administrateur peut abonner votre organisation.')
    expect(wrapper.text()).not.toContain('Découvrir les abonnements')
  })

  it('affiche un message quand aucune demande n’a été reçue', () => {
    const wrapper = mount(SupplierRfqsIndex, {
      props: { rfqs: [], upsell: null, filters: noFilter },
    })

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
    closed: false,
    canWrite: true,
    hasOlder: false,
    messages: [],
  }
  const open = {
    quote: null,
    canQuote: true,
    upsell: null,
    thread,
    documents: [],
    canUploadQuote: false,
  }

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
        documents: [],
        canUploadQuote: false,
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

  it('affiche le statut expiré du fournisseur (#232)', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: {
        ...open,
        canQuote: false,
        rfq: detail({ status: 'expired', myStatus: 'expired', myState: 'expired' }),
      },
    })

    expect(wrapper.text()).toContain('Expiré')
    expect(wrapper.find('[data-test="late-reply"]').exists()).toBe(false)
  })

  it('signale sa réponse tardive (#232)', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: {
        ...open,
        rfq: detail({ status: 'expired', myStatus: 'responded', myLateReply: true }),
      },
    })

    expect(wrapper.find('[data-test="late-reply"]').text()).toBe('Réponse tardive')
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

describe('« Demandes reçues » : statuts, filtres et devis envoyé (#230)', () => {
  const thread = {
    rfqSupplierId: 1,
    counterpartName: null,
    blocked: false,
    closed: false,
    canWrite: true,
    hasOlder: false,
    messages: [],
  }
  const open = { quote: null, canQuote: true, upsell: null, thread }
  const sent = {
    id: 11,
    filename: 'devis-acme.pdf',
    sizeBytes: 2048,
    receivedAt: '2026-11-20T10:00:00.000Z',
    viaMail: true,
  }

  it('affiche le statut lisible de chaque demande, pas le statut technique', () => {
    const wrapper = mount(SupplierRfqsIndex, {
      props: {
        rfqs: [
          rfq({ myStatus: 'viewed', myState: 'to_process' }),
          rfq({ id: 2, myStatus: 'responded', myState: 'responded', myLateReply: true }),
          rfq({ id: 3, myStatus: 'expired', myState: 'expired' }),
        ],
        upsell: null,
        filters: noFilter,
      },
    })

    const states = wrapper.findAll('[data-test="supplier-rfq-state"]').map((b) => b.text())
    expect(states).toEqual(['À traiter', 'Répondu', 'Expiré'])
    expect(wrapper.text()).not.toContain('En cours')
    expect(wrapper.findAll('[data-test="late-reply"]')).toHaveLength(1)
  })

  it('filtre par statut par une visite Inertia qui garde l’état, filtre dans l’URL', async () => {
    const wrapper = mount(SupplierRfqsIndex, {
      props: { rfqs: [rfq()], upsell: null, filters: noFilter },
    })

    await wrapper.find('#supplier-rfq-filter-status').setValue('expired')

    expect(router.get).toHaveBeenCalledWith(
      'supplier.rfqs.index:',
      { status: 'expired' },
      expect.objectContaining({ preserveState: true, replace: true })
    )
  })

  it('distingue « aucun résultat pour ce filtre » d’une liste vide, et propose de réinitialiser', async () => {
    vi.mocked(router.get).mockClear()
    const wrapper = mount(SupplierRfqsIndex, {
      props: { rfqs: [], upsell: null, filters: { status: 'declined' } },
    })

    expect(wrapper.text()).toContain('Aucune demande pour ce statut.')
    expect(wrapper.text()).not.toContain('Aucune demande reçue pour le moment.')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Réinitialiser le filtre')!
      .trigger('click')
    expect(router.get).toHaveBeenCalledWith('supplier.rfqs.index:', {}, expect.anything())
  })

  it('liste le devis envoyé avec un lien vers son fichier d’origine', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: { ...open, rfq: detail(), documents: [sent], canUploadQuote: false },
    })

    const link = wrapper.find('[data-test="sent-quote-document"] a')
    expect(link.attributes('href')).toBe('supplier.quote_documents.download:11')
    expect(link.text()).toContain('devis-acme.pdf')
    expect(wrapper.text()).toContain('Par mail')
    // Pas de dépôt possible : pas de formulaire.
    expect(wrapper.find('[data-test="quote-document-upload"]').exists()).toBe(false)
  })

  it('« Votre réponse » rappelle le devis PDF envoyé au lieu d’inviter à répondre', () => {
    const before = mount(SupplierRfqShow, {
      props: { ...open, rfq: detail(), documents: [], canUploadQuote: true },
    })
    expect(before.find('[data-test="response-text"]').text()).toBe('Chiffrez ce besoin.')

    const after = mount(SupplierRfqShow, {
      props: { ...open, rfq: detail(), documents: [sent], canUploadQuote: true },
    })
    expect(after.find('[data-test="response-text"]').text()).toBe(
      'Vous avez envoyé un devis PDF pour cette demande.'
    )
  })

  it('masque la section tant qu’il n’y a ni devis envoyé ni dépôt possible', () => {
    const wrapper = mount(SupplierRfqShow, {
      props: { ...open, rfq: detail(), documents: [], canUploadQuote: false },
    })

    expect(wrapper.text()).not.toContain('Devis envoyé')
  })

  it('dépose un PDF en multipart vers la route du fournisseur', async () => {
    formPost.mockClear()
    const wrapper = mount(SupplierRfqShow, {
      props: { ...open, rfq: detail(), documents: [], canUploadQuote: true },
    })
    expect(wrapper.text()).toContain('Aucun devis PDF envoyé pour le moment.')
    const submit = wrapper.find('[data-test="quote-document-upload"] button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()

    const input = wrapper.find('#quote-document-file')
    const file = new File(['%PDF-1.4'], 'devis.pdf', { type: 'application/pdf' })
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    expect(wrapper.find('[data-test="selected-file"]').text()).toBe('devis.pdf')

    await wrapper.find('[data-test="quote-document-upload"]').trigger('submit')
    expect(formPost).toHaveBeenCalledWith(
      'supplier.quote_documents.store:1',
      expect.objectContaining({ forceFormData: true, preserveScroll: true })
    )
  })
})
