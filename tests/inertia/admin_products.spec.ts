import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { answerConfirm, mountConfirmHost } from './support/confirm_dialog'
import type {
  AdminProductDetail,
  AdminProductIndexFilters,
  AdminProductListItem,
} from '#shared/types/admin_product'

const translations: Record<string, string> = {
  'admin.products.title': 'Produits',
  'admin.products.subtitle': 'Tous les produits.',
  'admin.products.empty': 'Aucun produit.',
  'admin.products.emptyDescription': 'Élargissez la liste.',
  'admin.products.back': 'Retour',
  'admin.products.filters.search': 'Rechercher',
  'admin.products.filters.supplier': 'Fournisseur',
  'admin.products.filters.allSuppliers': 'Tous les fournisseurs',
  'admin.products.filters.category': 'Catégorie',
  'admin.products.filters.allCategories': 'Toutes les catégories',
  'admin.products.filters.visibility': 'Visibilité',
  'admin.products.filters.allVisibility': 'Toutes',
  'admin.products.filters.quality': 'Qualité',
  'admin.products.filters.allQuality': 'Tous',
  'admin.products.visibility.published': 'Publié',
  'admin.products.visibility.unpublished': 'Dépublié',
  'admin.products.visibility.hidden': 'Masqué',
  'admin.products.visibility.archived': 'Archivé',
  'admin.products.quality.no_image': 'Sans image',
  'admin.products.columns.name': 'Nom',
  'admin.products.detail.missing': 'Absente',
  'admin.products.detail.present': 'Présente',
  'admin.products.detail.archivedNotice': 'Produit archivé.',
  'admin.products.detail.actionsTitle': 'Actions',
  'admin.products.detail.overview': 'Synthèse',
  'admin.products.detail.noImages': 'Aucune image.',
  'admin.products.actions.hide.label': 'Masquer',
  'admin.products.actions.hide.confirm': 'Masquer ?',
  'admin.products.actions.hide.reasonLabel': 'Motif',
  'admin.products.actions.unhide.label': 'Révéler',
  'admin.products.actions.unhide.confirm': 'Révéler ?',
  'admin.products.actions.unpublish.label': 'Dépublier',
  'admin.products.actions.unpublish.confirm': 'Dépublier ?',
  'admin.products.actions.publish.label': 'Publier',
  'admin.products.actions.publish.confirm': 'Publier ?',
  'admin.products.actions.archive.label': 'Archiver',
  'admin.products.actions.archive.confirm': 'Archiver ?',
  'admin.products.actions.restore.label': 'Restaurer',
  'admin.products.actions.restore.confirm': 'Restaurer ?',
  'admin.products.actions.reindex.label': 'Réindexer',
  'admin.products.actions.reindex.confirm': 'Réindexer ?',
  'admin.products.lifecycleStatus.active': 'Actif',
  'admin.products.lifecycleStatus.retired': 'Retiré',
  'admin.products.moderationStatus.approved': 'Approuvé',
  'admin.products.moderationStatus.rejected': 'Rejeté',
  'admin.trade.filters.apply': 'Filtrer',
  'admin.trade.filters.reset': 'Réinitialiser',
  'admin.pagination.previous': 'Précédent',
  'admin.pagination.next': 'Suivant',
}

const get = vi.fn()
const post = vi.fn()
const formPost = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    useForm: (data: Record<string, unknown>) =>
      reactive({
        ...data,
        errors: { reason: 'Motif requis' } as Record<string, string>,
        processing: false,
        reset: vi.fn(),
        post: (url: string, options: unknown) => formPost(url, options),
      }),
    router: {
      get: (...args: unknown[]) => get(...args),
      post: (...args: unknown[]) => post(...args),
    },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params?: Record<string, number | string>) =>
    `/fr/${name}${params?.id ? `/${params.id}` : ''}`,
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Index } = await import('~/pages/admin/products/index.vue')
const { default: Show } = await import('~/pages/admin/products/show.vue')

const NO_FILTERS: AdminProductIndexFilters = {
  search: null,
  supplierId: null,
  categoryId: null,
  visibility: null,
  quality: null,
}

function item(id: number, extra: Partial<AdminProductListItem> = {}): AdminProductListItem {
  return {
    id,
    name: `Produit ${id}`,
    slug: `produit-${id}`,
    supplierName: 'Acme',
    supplierOrganizationId: 9,
    categoryName: 'Mugs',
    visibilityStatus: 'published',
    variantsCount: 2,
    imagesCount: 1,
    stockStatus: null,
    createdAt: '2026-10-17T10:00:00.000Z',
    ...extra,
  }
}

function renderIndex(data: AdminProductListItem[], filters = NO_FILTERS, lastPage = 1) {
  return mount(Index, {
    props: {
      productList: { data, meta: { total: data.length, perPage: 25, currentPage: 1, lastPage } },
      filters,
      filterOptions: {
        categories: [
          { id: 1, name: 'Objets', depth: 0 },
          { id: 2, name: 'Mugs', depth: 1 },
        ],
        suppliers: [{ id: 9, name: 'Acme' }],
      },
      canManage: true,
    },
  })
}

describe('admin/products/index', () => {
  beforeEach(() => get.mockClear())

  it('affiche les lignes, le badge de visibilité et le lien vers la fiche', () => {
    const wrapper = renderIndex([item(1), item(2, { visibilityStatus: 'hidden' })])
    const rows = wrapper.findAll('tbody tr')

    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Publié')
    expect(rows[1].text()).toContain('Masqué')
    expect(rows[0].find('a').attributes('href')).toBe('/fr/admin.products.show/1')
  })

  it('affiche l’état vide', () => {
    const wrapper = renderIndex([])
    expect(wrapper.text()).toContain('Aucun produit.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('indente les catégories selon la profondeur', () => {
    const options = renderIndex([item(1)]).findAll('#product-category option')
    expect(options[2].element.textContent).toBe('\u00a0\u00a0Mugs')
  })

  it('Filtrer envoie les filtres actifs (identifiants numériques)', async () => {
    const wrapper = renderIndex([item(1)])

    await wrapper.find('#product-search').setValue(' mug ')
    await wrapper.find('#product-supplier').setValue('9')
    await wrapper.find('#product-category').setValue('2')
    await wrapper.find('#product-visibility').setValue('hidden')
    await wrapper.find('form').trigger('submit')

    expect(get).toHaveBeenCalledWith(
      '/fr/admin.products.index',
      { page: 1, search: 'mug', supplierId: 9, categoryId: 2, visibility: 'hidden' },
      expect.objectContaining({ preserveState: true, only: ['productList', 'filters'] })
    )
  })

  it('pagine en conservant les filtres', async () => {
    const wrapper = renderIndex([item(1)], { ...NO_FILTERS, quality: 'no_image' }, 3)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Suivant')!
      .trigger('click')

    expect(get).toHaveBeenCalledWith(
      '/fr/admin.products.index',
      { page: 2, quality: 'no_image' },
      expect.anything()
    )
  })
})

function detail(extra: Partial<AdminProductDetail> = {}): AdminProductDetail {
  return {
    ...item(5, { name: 'Mug' }),
    isActive: true,
    lifecycleStatus: 'active',
    moderationStatus: 'approved',
    moderationHistory: [],
    variants: [],
    priceTiers: [],
    images: [],
    translations: [{ locale: 'fr', name: 'Mug', hasDescription: false }],
    certifications: [],
    attributes: [],
    supplierSlug: 'acme',
    categorySlug: 'mugs',
    canManage: true,
    ...extra,
  }
}

const mountShow = (product: AdminProductDetail) => mount(Show, { props: { product } })
const labels = (wrapper: ReturnType<typeof mountShow>) =>
  wrapper.findAll('button').map((b) => b.text())

describe('admin/products/show', () => {
  beforeEach(() => {
    post.mockClear()
    formPost.mockClear()
  })

  it('affiche le titre, le lien fournisseur et la présence des traductions', () => {
    const wrapper = mountShow(detail())

    expect(wrapper.find('h1').text()).toBe('Mug')
    expect(wrapper.find('a[href="/fr/admin.organizations.show/9"]').exists()).toBe(true)
    expect(wrapper.find('[data-locale="fr"]').text()).toContain('Absente')
    expect(wrapper.find('[data-locale="en"]').text()).toContain('Absente')
  })

  it('sans canManage : aucune action ni formulaire', () => {
    const wrapper = mountShow(detail({ canManage: false }))
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('produit publié : masquer, dépublier, archiver, réindexer', () => {
    const wrapper = mountShow(detail())
    expect(labels(wrapper)).toEqual(['Dépublier', 'Archiver', 'Réindexer', 'Masquer'])
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('produit dépublié : proposer Publier', () => {
    expect(labels(mountShow(detail({ isActive: false })))).toContain('Publier')
  })

  it('produit masqué : Révéler, plus de formulaire de masquage', () => {
    const wrapper = mountShow(detail({ moderationStatus: 'rejected' }))
    expect(labels(wrapper)).toContain('Révéler')
    expect(labels(wrapper)).not.toContain('Masquer')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('produit archivé : bandeau, Restaurer et Réindexer seulement', () => {
    const wrapper = mountShow(detail({ lifecycleStatus: 'retired', isActive: false }))
    expect(wrapper.text()).toContain('Produit archivé.')
    expect(labels(wrapper)).toEqual(['Restaurer', 'Réindexer'])
  })

  it('archiver confirmé envoie un POST ; refusé, rien', async () => {
    const host = await mountConfirmHost()
    const wrapper = mountShow(detail())
    const archive = wrapper.findAll('button').find((b) => b.text() === 'Archiver')!

    await archive.trigger('click')
    expect(host.find('[data-confirm-dialog="message"]').text()).toBe('Archiver ?')
    expect(host.find('[data-confirm-dialog="confirm"]').text()).toBe('Archiver')
    expect(host.find('[data-confirm-dialog="confirm"]').classes()).toContain('text-danger')
    await answerConfirm(host, 'cancel')
    expect(post).not.toHaveBeenCalled()

    await archive.trigger('click')
    await answerConfirm(host, 'confirm')
    expect(post).toHaveBeenCalledWith(
      '/fr/admin.products.archive/5',
      {},
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('masquer envoie le formulaire de motif et affiche l’erreur', async () => {
    const host = await mountConfirmHost()
    const wrapper = mountShow(detail())

    expect(wrapper.text()).toContain('Motif requis')
    await wrapper.find('form').trigger('submit')
    expect(host.find('[data-confirm-dialog="message"]').text()).toBe('Masquer ?')
    await answerConfirm(host, 'cancel')
    expect(formPost).not.toHaveBeenCalled()

    await wrapper.find('form').trigger('submit')
    await answerConfirm(host, 'confirm')
    expect(formPost).toHaveBeenCalledWith(
      '/fr/admin.products.hide/5',
      expect.objectContaining({ preserveScroll: true })
    )
  })
})
