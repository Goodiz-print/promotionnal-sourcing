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
  'categories.index.moveUp': 'Monter',
  'categories.index.moveDown': 'Descendre',
  'categories.confirmDelete': 'Supprimer cette catégorie ?',
}

const routerMock = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn(), patch: vi.fn() }))

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: routerMock,
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

  it('désactive monter/descendre en bout de liste et envoie le déplacement', async () => {
    const wrapper = mount(Index, {
      props: {
        categories: [
          category(1, 'Premier', 'premier', { canMoveDown: true }),
          category(2, 'Dernier', 'dernier', { canMoveUp: true, depth: 1 }),
        ],
      },
    })

    const up = wrapper.findAll('button[aria-label="Monter"]')
    const down = wrapper.findAll('button[aria-label="Descendre"]')
    expect(up[0].attributes('disabled')).toBeDefined()
    expect(up[1].attributes('disabled')).toBeUndefined()
    expect(down[0].attributes('disabled')).toBeUndefined()
    expect(down[1].attributes('disabled')).toBeDefined()

    await down[0].trigger('click')
    expect(routerMock.patch).toHaveBeenCalledWith(
      expect.any(String),
      { direction: 'down' },
      expect.objectContaining({ preserveScroll: true })
    )

    // Un second clic avant la fin de la visite est ignoré.
    const options = routerMock.patch.mock.calls[0][2] as {
      onStart: () => void
      onFinish: () => void
    }
    options.onStart()
    await wrapper.vm.$nextTick()
    await wrapper.findAll('button[aria-label="Monter"]')[1].trigger('click')
    expect(routerMock.patch).toHaveBeenCalledTimes(1)
    options.onFinish()
  })

  it('affiche un état vide', () => {
    const wrapper = mount(Index, { props: { categories: [] } })
    expect(wrapper.text()).toContain('Aucune catégorie pour le moment. Créez-en une.')
  })
})
