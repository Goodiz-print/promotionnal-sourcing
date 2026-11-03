import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdminModerationFilters, AdminModerationItem } from '#shared/types/admin_moderation'

const translations = {
  'admin.moderation.title': 'Modération',
  'admin.moderation.subtitle': 'À valider.',
  'admin.moderation.empty': 'Rien à modérer.',
  'admin.moderation.emptyDescription': 'Revenez plus tard.',
  'admin.moderation.review': 'Examiner',
  'admin.moderation.types.organization': 'Fournisseur',
  'admin.moderation.types.product': 'Produit',
  'admin.moderation.statuses.pending': 'En attente',
  'admin.moderation.statuses.approved': 'Approuvé',
  'admin.moderation.statuses.rejected': 'Rejeté',
  'admin.moderation.filters.type': 'Type',
  'admin.moderation.filters.status': 'Statut',
  'admin.moderation.filters.age': 'Ancienneté',
  'admin.moderation.filters.all': 'Tous',
  'admin.moderation.ages.0': 'Toutes',
  'admin.moderation.ages.7': 'Plus de 7 jours',
  'admin.moderation.ages.30': 'Plus de 30 jours',
  'admin.moderation.form.title': 'Décision',
  'admin.moderation.form.reason': 'Motif',
  'admin.moderation.form.approve': 'Approuver',
  'admin.moderation.form.reject': 'Rejeter',
  'admin.pagination.previous': 'Précédent',
  'admin.pagination.next': 'Suivant',
}

const get = vi.fn()
const post = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: m.makeUseForm({ post: (...args: unknown[]) => post(...args) }),
    router: { get: (...args: unknown[]) => get(...args) },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: (name: string) => `/fr/${name}` }))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Index } = await import('~/pages/admin/moderation/index.vue')
const { default: DecisionForm } = await import('~/components/admin/moderation_decision_form.vue')

const FILTERS: AdminModerationFilters = { type: null, status: 'pending', minAgeDays: 0 }

function item(id: number, extra: Partial<AdminModerationItem> = {}): AdminModerationItem {
  return {
    targetType: 'organization',
    targetId: id,
    label: `Fournisseur ${id}`,
    subtitle: null,
    status: 'pending',
    submittedAt: '2026-10-31T10:00:00.000Z',
    ...extra,
  }
}

function render(items: AdminModerationItem[]) {
  return mount(Index, {
    props: {
      queue: {
        data: items,
        meta: { total: items.length, perPage: 25, currentPage: 1, lastPage: 1 },
      },
      filters: FILTERS,
    },
  })
}

describe('admin/moderation/index', () => {
  beforeEach(() => {
    get.mockClear()
    post.mockClear()
  })

  it('liste les éléments avec leur type, leur contexte et leur statut', () => {
    const wrapper = render([
      item(1),
      item(2, { targetType: 'product', label: 'Gourde', subtitle: 'Acme', status: 'rejected' }),
    ])
    const rows = wrapper.findAll('tbody tr')

    expect(rows[0].text()).toContain('Fournisseur 1')
    expect(rows[0].text()).toContain('En attente')
    expect(rows[1].text()).toContain('Gourde')
    expect(rows[1].text()).toContain('Produit')
    expect(rows[1].text()).toContain('Acme')
    expect(rows[1].text()).toContain('Rejeté')
  })

  it('affiche l’état vide sans tableau', () => {
    const wrapper = render([])

    expect(wrapper.text()).toContain('Rien à modérer.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('changer le type relance la visite avec ce filtre, à la page 1', async () => {
    const wrapper = render([item(1)])

    await wrapper.find('#moderation-type').setValue('product')

    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0][1]).toMatchObject({ type: 'product', status: 'pending', page: 1 })
  })
})

describe('moderation_decision_form', () => {
  beforeEach(() => post.mockClear())

  it('approuver et rejeter envoient une requête vers la route de décision', async () => {
    const wrapper = mount(DecisionForm, { props: { targetType: 'product', targetId: 4 } })
    const [approve, reject] = wrapper.findAll('button')

    await approve.trigger('click')
    await reject.trigger('click')

    expect(post).toHaveBeenCalledTimes(2)
    expect(post.mock.calls[0][0]).toBe('/fr/admin.moderation.decide')
  })
})
