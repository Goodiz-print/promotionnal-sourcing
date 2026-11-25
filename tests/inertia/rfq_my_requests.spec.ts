import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, confirmText, mountConfirmHost } from './support/confirm_dialog'
import type { QuoteDocumentType } from '#shared/types/quote'
import type { RfqBatchGroupType, RfqListItemType } from '#shared/types/rfq'

const translations = {
  'rfq.index.title': 'Demandes de devis',
  'rfq.index.batch': 'Panier du {date} · {count} demandes',
  'rfq.index.quoteReceived': 'Devis reçu',
  'rfq.index.unknownAuthor': 'Auteur inconnu',
  'rfq.index.progress.sent': 'Envoyée',
  'rfq.index.progress.responded': 'Répondue',
  'rfq.index.filters.status': 'Statut',
  'rfq.index.filters.author': 'Auteur',
  'rfq.index.filters.allStatuses': 'Tous les statuts',
  'rfq.index.filters.allAuthors': 'Tous les auteurs',
  'rfq.index.filters.reset': 'Réinitialiser les filtres',
  'quote.documents.empty': 'Aucun devis PDF reçu pour le moment.',
  'quote.documents.select': 'Retenir',
  'quote.documents.selected': 'Retenu',
  'quote.documents.confirmSelect': 'Retenir ce devis clôture la demande.',
  'quote.documents.confirmSelectTitle': 'Retenir ce devis ?',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { get: vi.fn(), post: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params: Record<string, unknown> = {}) =>
    `/${name}/${params.id ?? ''}`.replace(/\/$/, ''),
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: RfqListFilters } = await import('~/components/rfqs/rfq_list_filters.vue')
const { default: RfqListTable } = await import('~/components/rfqs/rfq_list_table.vue')
const { default: RfqQuoteDocuments } = await import('~/components/rfqs/rfq_quote_documents.vue')
const { router } = await import('@inertiajs/vue3')

const BATCH = '3f2b8c1e-4a5d-4e6f-9a7b-8c9d0e1f2a3b'

function row(overrides: Partial<RfqListItemType> = {}): RfqListItemType {
  return {
    id: 1,
    batchId: null,
    title: 'Tote bags',
    status: 'published',
    deadline: null,
    budgetMax: null,
    itemCount: 1,
    supplierCount: 2,
    respondedCount: 0,
    publishedAt: '2026-11-20T08:00:00.000Z',
    closedAt: null,
    expiredAt: null,
    createdAt: '2026-11-20T08:00:00.000Z',
    createdByName: 'Camille Martin',
    progress: 'sent',
    hasReceivedQuote: false,
    ...overrides,
  }
}

function document(overrides: Partial<QuoteDocumentType> = {}): QuoteDocumentType {
  return {
    id: 7,
    rfqSupplierId: 3,
    supplierName: 'Textiles du Nord',
    filename: 'devis.pdf',
    sizeBytes: 12_000,
    receivedAt: '2026-11-21T09:00:00.000Z',
    selectedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(router.get).mockClear()
  vi.mocked(router.post).mockClear()
})
afterEach(() => vi.unstubAllGlobals())

describe('rfq_list_table.vue (#228)', () => {
  it('regroupe un panier sous une ligne d’en-tête, une demande seule n’en a pas', () => {
    const groups: RfqBatchGroupType[] = [
      {
        key: BATCH,
        batchId: BATCH,
        rfqs: [row({ id: 1, batchId: BATCH }), row({ id: 2, batchId: BATCH, title: 'Stylos' })],
      },
      { key: 'rfq-3', batchId: null, rfqs: [row({ id: 3, title: 'Gourdes' })] },
    ]

    const wrapper = mount(RfqListTable, { props: { groups } })

    const headers = wrapper.findAll('[data-batch-header]')
    expect(headers).toHaveLength(1)
    expect(headers[0].text()).toContain('2 demandes')
    expect(wrapper.findAll(`[data-batch="${BATCH}"]`)).toHaveLength(2)
    expect(wrapper.findAll('tbody tr')).toHaveLength(4)
  })

  it('montre l’auteur, l’avancement et l’indicateur « devis reçu »', () => {
    const groups: RfqBatchGroupType[] = [
      {
        key: 'rfq-1',
        batchId: null,
        rfqs: [row({ progress: 'responded', respondedCount: 1, hasReceivedQuote: true })],
      },
      { key: 'rfq-2', batchId: null, rfqs: [row({ id: 2, createdByName: null })] },
    ]

    const wrapper = mount(RfqListTable, { props: { groups } })
    const [answered, waiting] = wrapper.findAll('tbody tr')

    expect(answered.text()).toContain('Camille Martin')
    expect(answered.text()).toContain('Répondue')
    expect(answered.text()).toContain('Devis reçu')
    expect(waiting.text()).toContain('Auteur inconnu')
    expect(waiting.text()).toContain('Envoyée')
    expect(waiting.text()).not.toContain('Devis reçu')
  })
})

describe('rfq_list_filters.vue (#228)', () => {
  const authors = [
    { id: 4, name: 'Camille Martin' },
    { id: 5, name: 'Mia Member' },
  ]

  it('un filtre choisi relance la visite avec les filtres en query string', async () => {
    const wrapper = mount(RfqListFilters, {
      props: { filters: { status: null, authorId: 5 }, authors },
    })

    await wrapper.find('#rfq-filter-status').setValue('responded')

    expect(router.get).toHaveBeenCalledWith(
      '/rfqs.index',
      { status: 'responded', authorId: '5' },
      expect.objectContaining({ preserveState: true, replace: true })
    )
  })

  it('propose de réinitialiser seulement quand un filtre est posé', async () => {
    const unfiltered = mount(RfqListFilters, {
      props: { filters: { status: null, authorId: null }, authors },
    })
    expect(unfiltered.text()).not.toContain('Réinitialiser les filtres')

    const filtered = mount(RfqListFilters, {
      props: { filters: { status: 'sent', authorId: 4 }, authors },
    })
    const reset = filtered.findAll('button').find((b) => b.text().includes('Réinitialiser'))
    await reset!.trigger('click')

    expect(router.get).toHaveBeenCalledWith('/rfqs.index', {}, expect.anything())
  })

  it('liste les auteurs proposés', () => {
    const wrapper = mount(RfqListFilters, {
      props: { filters: { status: null, authorId: null }, authors },
    })

    const options = wrapper.findAll('#rfq-filter-author option').map((option) => option.text())
    expect(options).toEqual(['Tous les auteurs', 'Camille Martin', 'Mia Member'])
  })
})

describe('rfq_quote_documents.vue (#228)', () => {
  it('liste les PDF avec un lien vers la route de téléchargement de l’agence', () => {
    const wrapper = mount(RfqQuoteDocuments, {
      props: { documents: [document()], canSelect: false },
    })

    const link = wrapper.find('a[download]')
    expect(link.attributes('href')).toBe('/quote_documents.download/7')
    expect(wrapper.text()).toContain('Textiles du Nord')
    expect(wrapper.text()).not.toContain('Retenir')
  })

  it('« Retenir » ouvre la confirmation du design system, puis envoie la visite', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(RfqQuoteDocuments, {
      props: { documents: [document()], canSelect: true },
    })

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Retenir')!
      .trigger('click')

    expect(confirmText(host, 'title')).toBe('Retenir ce devis ?')
    expect(confirmText(host)).toBe('Retenir ce devis clôture la demande.')
    expect(router.post).not.toHaveBeenCalled()

    await answerConfirm(host, 'confirm')

    expect(router.post).toHaveBeenCalledWith(
      '/quote_documents.select/7',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('annuler la confirmation n’envoie rien', async () => {
    const host = await mountConfirmHost()
    const wrapper = mount(RfqQuoteDocuments, {
      props: { documents: [document()], canSelect: true },
    })

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Retenir')!
      .trigger('click')
    await answerConfirm(host, 'cancel')

    expect(router.post).not.toHaveBeenCalled()
  })

  it('un devis retenu porte son badge, sans bouton', () => {
    const wrapper = mount(RfqQuoteDocuments, {
      props: { documents: [document({ selectedAt: '2026-11-22T10:00:00.000Z' })], canSelect: true },
    })

    expect(wrapper.text()).toContain('Retenu')
    expect(wrapper.findAll('button')).toHaveLength(0)
  })

  it('aucun PDF : état vide', () => {
    const wrapper = mount(RfqQuoteDocuments, { props: { documents: [], canSelect: true } })

    expect(wrapper.text()).toContain('Aucun devis PDF reçu pour le moment.')
  })
})
