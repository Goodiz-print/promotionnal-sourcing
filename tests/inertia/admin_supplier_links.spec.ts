import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdminSupplierLinkFilters, AdminSupplierLinkItem } from '#shared/types/supplier_link'

const translations = {
  'admin.supplierLinks.title': 'Rattachement des fiches fournisseur',
  'admin.supplierLinks.subtitle': 'Fiches importées.',
  'admin.supplierLinks.unpublishedNotice': 'Ces fiches et leurs produits ne sont pas publiés.',
  'admin.supplierLinks.resultsCount': '{count} fiches',
  'admin.supplierLinks.empty.pending': 'Aucune fiche en attente.',
  'admin.supplierLinks.empty.linked': 'Aucune fiche rattachée.',
  'admin.supplierLinks.emptyDescription': 'Revenez après le prochain import.',
  'admin.supplierLinks.filters.status': 'Affichage',
  'admin.supplierLinks.filters.pending': 'En attente',
  'admin.supplierLinks.filters.linked': 'Rattachées',
  'admin.supplierLinks.columns.supplier': 'Fiche',
  'admin.supplierLinks.columns.products': 'Produits',
  'admin.supplierLinks.columns.suggestion': 'Proposition',
  'admin.supplierLinks.columns.organization': 'Organisation',
  'admin.supplierLinks.columns.actions': 'Actions',
  'admin.supplierLinks.noSuggestion': 'Aucune correspondance',
  'admin.supplierLinks.chooseOrganization': 'Choisir',
  'admin.pagination.previous': 'Précédent',
  'admin.pagination.next': 'Suivant',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: (name: string) => `/fr/${name}` }))

const { default: Index } = await import('~/pages/admin/supplier_links/index.vue')

function supplier(id: number): AdminSupplierLinkItem {
  return {
    id,
    slug: `fiche-${id}`,
    name: `Fiche ${id}`,
    country: 'FR',
    email: null,
    website: null,
    productsCount: 4,
    organization: null,
    linkedAt: null,
    linkedByEmail: null,
    suggestion: null,
  }
}

function render(filters: AdminSupplierLinkFilters, data: AdminSupplierLinkItem[]) {
  return mount(Index, {
    props: {
      suppliers: { data, meta: { total: data.length, perPage: 25, currentPage: 1, lastPage: 1 } },
      organizationOptions: [],
      filters,
    },
  })
}

describe('admin/supplier_links/index.vue (#240)', () => {
  it('signale que les fiches en attente ne sont pas publiées', () => {
    const wrapper = render({ status: 'pending' }, [supplier(1)])

    const notice = wrapper.find('[data-testid="unpublished-notice"]')
    expect(notice.exists()).toBe(true)
    expect(notice.text()).toContain('ne sont pas publiés')
    expect(wrapper.text()).toContain('Fiche 1')
  })

  it("n'affiche pas l'avertissement sur les fiches rattachées", () => {
    const wrapper = render({ status: 'linked' }, [])

    expect(wrapper.find('[data-testid="unpublished-notice"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Aucune fiche rattachée.')
  })
})
