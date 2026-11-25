import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, confirmPart, confirmText, mountConfirmHost } from './support/confirm_dialog'
import type { RfqDetailType, RfqListItemType, RfqSupplierType, RfqType } from '#shared/types/rfq'

const translations = {
  'rfq.index.title': 'Demandes de devis',
  'rfq.index.subtitle': 'Sous-titre',
  'rfq.index.empty': 'Aucune demande pour le moment.',
  'rfq.index.new': 'Nouvelle demande',
  'rfq.index.itemCount': '{count} lignes',
  'rfq.index.supplierCount': '{count} destinataires',
  'rfq.index.responded': '{responded} / {total} réponses',
  'rfq.index.progress.draft': 'Brouillon',
  'rfq.index.progress.sent': 'Envoyée',
  'rfq.index.noMatch': 'Aucune demande ne correspond à ces filtres.',
  'rfq.status.draft': 'Brouillon',
  'rfq.status.published': 'Publiée',
  'rfq.status.closed': 'Clôturée',
  'rfq.supplierStatus.pending': 'À envoyer',
  'rfq.supplierStatus.sent': 'Envoyée',
  'rfq.supplierStatus.responded': 'A répondu',
  'rfq.supplierStatus.expired': 'Expirée sans réponse',
  'rfq.lateReply': 'Réponse tardive',
  'rfq.show.backToList': 'Retour aux demandes',
  'rfq.show.needTitle': 'Le besoin',
  'rfq.show.suppliersTitle': 'Destinataires',
  'rfq.show.noSuppliers': 'Aucun destinataire sélectionné.',
  'rfq.show.noDeadline': 'Sans échéance',
  'rfq.show.addSuppliers': 'Ajouter des destinataires',
  'rfq.show.removeSupplier': 'Retirer',
  'rfq.actions.publish': 'Publier',
  'rfq.actions.send': 'Envoyer aux destinataires',
  'rfq.actions.close': 'Clôturer',
  'rfq.actions.confirmClose': 'Clôturer cette demande ?',
  'rfq.actions.delete': 'Supprimer le brouillon',
  'rfq.actions.confirmDelete': 'Supprimer ce brouillon ?',
  'rfq.fields.suppliers': 'Fournisseurs consultés',
  'rfq.suppliers.selected': '{count} sélectionnés',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { post: vi.fn(), delete: vi.fn(), get: vi.fn() },
    useForm: m.makeUseForm(),
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: () => '/fr/rfqs/1' }))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: RfqsIndex } = await import('~/pages/rfqs/index.vue')
const { default: RfqShow } = await import('~/pages/rfqs/show.vue')
const { router } = await import('@inertiajs/vue3')

function rfq(overrides: Partial<RfqType> = {}): RfqType {
  return {
    id: 1,
    batchId: null,
    title: 'Tote bags coton bio',
    status: 'draft',
    deadline: null,
    budgetMax: null,
    itemCount: 2,
    supplierCount: 0,
    respondedCount: 0,
    publishedAt: null,
    closedAt: null,
    expiredAt: null,
    createdAt: '2026-08-20T00:00:00.000Z',
    ...overrides,
  }
}

function supplier(overrides: Partial<RfqSupplierType> = {}): RfqSupplierType {
  return {
    id: 10,
    supplierOrganizationId: 100,
    name: 'Fournisseur A',
    slug: 'fournisseur-a',
    logoUrl: null,
    status: 'pending',
    sentAt: null,
    lateReply: false,
    ...overrides,
  }
}

function detail(overrides: Partial<RfqDetailType> = {}): RfqDetailType {
  return {
    ...rfq(),
    description: null,
    createdByName: null,
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
    suppliers: [],
    ...overrides,
  }
}

describe('rfqs/index.vue', () => {
  const noFilters = { status: null, authorId: null }

  function listed(overrides: Partial<RfqListItemType> = {}): RfqListItemType {
    return {
      ...rfq(),
      createdByName: null,
      progress: 'draft',
      hasReceivedQuote: false,
      ...overrides,
    }
  }

  it('liste les demandes avec leur avancement', () => {
    const wrapper = mount(RfqsIndex, {
      props: {
        groups: [
          { key: 'rfq-1', batchId: null, rfqs: [listed()] },
          {
            key: 'rfq-2',
            batchId: null,
            rfqs: [listed({ id: 2, title: 'Gourdes inox', status: 'published', progress: 'sent' })],
          },
        ],
        filters: noFilters,
        authors: [],
        canSendRfq: true,
        canManageRfq: true,
      },
    })

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.text()).toContain('Tote bags coton bio')
    expect(wrapper.text()).toContain('Brouillon')
    expect(wrapper.text()).toContain('Envoyée')
  })

  it('affiche un message quand il n’y a aucune demande', () => {
    const wrapper = mount(RfqsIndex, {
      props: { groups: [], filters: noFilters, authors: [], canSendRfq: true, canManageRfq: true },
    })

    expect(wrapper.text()).toContain('Aucune demande pour le moment.')
    expect(wrapper.findAll('tbody tr')).toHaveLength(0)
    // Rien à filtrer : pas de filtres sur une agence sans demande.
    expect(wrapper.find('[role="search"]').exists()).toBe(false)
  })

  it('distingue « aucun résultat pour ces filtres » de « aucune demande »', () => {
    const wrapper = mount(RfqsIndex, {
      props: {
        groups: [],
        filters: { status: 'responded', authorId: null },
        authors: [],
        canSendRfq: true,
        canManageRfq: true,
      },
    })

    expect(wrapper.text()).toContain('Aucune demande ne correspond à ces filtres.')
    expect(wrapper.text()).not.toContain('Aucune demande pour le moment.')
    expect(wrapper.find('[role="search"]').exists()).toBe(true)
  })
})

describe('rfqs/show.vue', () => {
  const baseProps = {
    categories: [],
    supplierOptions: [],
    canSendRfq: true,
    canManageRfq: true,
    quotes: [],
    quoteDocuments: [],
    supplierContacts: {},
    threads: [],
  }

  it('propose de publier un brouillon comportant des lignes', () => {
    const wrapper = mount(RfqShow, { props: { ...baseProps, rfq: detail() } })

    expect(wrapper.text()).toContain('Publier')
    // Rien à envoyer ni à clôturer tant que la demande n'est pas publiée.
    expect(wrapper.text()).not.toContain('Envoyer aux destinataires')
    expect(wrapper.text()).not.toContain('Clôturer')
  })

  it('ne propose pas de publier un brouillon vide', () => {
    const wrapper = mount(RfqShow, {
      props: { ...baseProps, rfq: detail({ itemCount: 0, items: [] }) },
    })

    expect(wrapper.text()).not.toContain('Publier')
  })

  it('propose l’envoi tant qu’un destinataire est en attente', () => {
    const wrapper = mount(RfqShow, {
      props: {
        ...baseProps,
        rfq: detail({ status: 'published', suppliers: [supplier()] }),
      },
    })

    expect(wrapper.text()).toContain('Envoyer aux destinataires')
    expect(wrapper.text()).toContain('Clôturer')
  })

  it('n’offre plus l’envoi quand tous les destinataires ont été notifiés', () => {
    const wrapper = mount(RfqShow, {
      props: {
        ...baseProps,
        rfq: detail({ status: 'published', suppliers: [supplier({ status: 'sent' })] }),
      },
    })

    expect(wrapper.text()).not.toContain('Envoyer aux destinataires')
  })

  it('un membre publie et envoie, mais ne clôture pas (#216)', () => {
    const draft = mount(RfqShow, {
      props: { ...baseProps, canManageRfq: false, rfq: detail() },
    })
    const published = mount(RfqShow, {
      props: {
        ...baseProps,
        canManageRfq: false,
        rfq: detail({ status: 'published', suppliers: [supplier()] }),
      },
    })

    expect(draft.text()).toContain('Publier')
    expect(published.text()).toContain('Envoyer aux destinataires')
    expect(published.text()).not.toContain('Clôturer')
  })

  it('masque toutes les actions sans droit d’envoi', () => {
    const wrapper = mount(RfqShow, {
      props: {
        ...baseProps,
        canSendRfq: false,
        canManageRfq: false,
        rfq: detail({ status: 'published' }),
      },
    })

    expect(wrapper.text()).not.toContain('Publier')
    expect(wrapper.text()).not.toContain('Clôturer')
  })

  it('permet de retirer un destinataire non notifié, pas un destinataire envoyé', async () => {
    const pending = mount(RfqShow, {
      props: { ...baseProps, rfq: detail({ suppliers: [supplier()] }) },
    })
    expect(pending.text()).toContain('Retirer')

    await pending
      .findAll('button')
      .find((button) => button.text() === 'Retirer')!
      .trigger('click')
    expect(router.delete).toHaveBeenCalled()

    const sent = mount(RfqShow, {
      props: { ...baseProps, rfq: detail({ suppliers: [supplier({ status: 'sent' })] }) },
    })
    expect(sent.text()).not.toContain('Retirer')
  })
  it('affiche un destinataire expiré et une réponse tardive (#232)', () => {
    const wrapper = mount(RfqShow, {
      props: {
        ...baseProps,
        rfq: detail({
          status: 'expired',
          suppliers: [
            supplier({ id: 10, status: 'expired' }),
            supplier({ id: 11, name: 'Fournisseur B', status: 'responded', lateReply: true }),
          ],
        }),
      },
    })

    expect(wrapper.text()).toContain('Expirée sans réponse')
    expect(wrapper.findAll('[data-test="late-reply"]')).toHaveLength(1)
  })

  describe('confirmation des actions irréversibles (#291)', () => {
    beforeEach(() => {
      vi.mocked(router.delete).mockClear()
      vi.mocked(router.post).mockClear()
    })

    function clickAction(wrapper: ReturnType<typeof mount>, label: string) {
      return wrapper
        .findAll('button')
        .find((button) => button.text() === label)!
        .trigger('click')
    }

    it('supprimer un brouillon : fenêtre « danger », annuler ne supprime rien', async () => {
      const host = await mountConfirmHost()
      const wrapper = mount(RfqShow, { props: { ...baseProps, rfq: detail() } })

      await clickAction(wrapper, 'Supprimer le brouillon')
      expect(confirmText(host)).toBe('Supprimer ce brouillon ?')
      expect(confirmPart(host, 'confirm').classes()).toContain('text-danger')
      await answerConfirm(host, 'cancel')
      expect(router.delete).not.toHaveBeenCalled()

      await clickAction(wrapper, 'Supprimer le brouillon')
      await answerConfirm(host, 'confirm')
      expect(router.delete).toHaveBeenCalled()
    })

    it('clôturer une demande publiée n’envoie la visite qu’après confirmation', async () => {
      const host = await mountConfirmHost()
      const wrapper = mount(RfqShow, {
        props: { ...baseProps, rfq: detail({ status: 'published' }) },
      })

      await clickAction(wrapper, 'Clôturer')
      await answerConfirm(host, 'cancel')
      expect(router.post).not.toHaveBeenCalled()

      await clickAction(wrapper, 'Clôturer')
      await answerConfirm(host, 'confirm')
      expect(router.post).toHaveBeenCalled()
    })
  })
})
