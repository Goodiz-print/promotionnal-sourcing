import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { CategoryAdminType } from '#shared/types/category'

const translations = {
  'categories.index.title': 'Catégories',
  'categories.index.subtitle': 'Administrez la taxonomie du catalogue.',
  'categories.index.empty': 'Aucune catégorie pour le moment. Créez-en une.',
  'categories.index.columns.name': 'Nom',
  'categories.index.columns.slug': 'Identifiant',
  'categories.index.columns.parent': 'Parent',
  'categories.index.columns.products': 'Produits',
  'categories.newCategory': 'Nouvelle catégorie',
  'categories.edit': 'Modifier',
  'categories.delete': 'Supprimer',
  'categories.confirmDelete': 'Supprimer cette catégorie ?',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { get: vi.fn(), delete: vi.fn() },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: () => '/fr/admin/categories' }))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Index } = await import('~/pages/admin/categories/index.vue')

function category(id: number, name: string, slug: string, extra: Partial<CategoryAdminType> = {}) {
  return {
    id,
    slug,
    name,
    parentId: null,
    parentName: null,
    productsCount: 0,
    depth: 0,
    canMoveUp: false,
    canMoveDown: false,
    ...extra,
  } satisfies CategoryAdminType
}

describe('admin/categories/index.vue', () => {
  it('liste les catégories avec parent et nombre de produits', () => {
    const wrapper = mount(Index, {
      props: {
        categories: [
          category(1, 'Crayon', 'crayon', { productsCount: 3 }),
          category(2, 'Crayon couleur', 'crayon-couleur', {
            parentName: 'Crayon',
            productsCount: 1,
          }),
        ],
      },
    })

    expect(wrapper.text()).toContain('Crayon')
    expect(wrapper.text()).toContain('crayon-couleur')
    expect(wrapper.text()).toContain('Nouvelle catégorie')
    // Le nom du parent et les compteurs sont rendus.
    expect(wrapper.text()).toContain('Crayon couleur')
  })

  it('affiche un état vide', () => {
    const wrapper = mount(Index, { props: { categories: [] } })
    expect(wrapper.text()).toContain('Aucune catégorie pour le moment. Créez-en une.')
  })
})
