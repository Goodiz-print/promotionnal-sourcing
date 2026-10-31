import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AdminUserListItem } from '#shared/types/admin'

const translations = {
  'admin.users.title': 'Utilisateurs',
  'admin.users.subtitle': 'Tous les comptes.',
  'admin.users.searchLabel': 'Rechercher par email',
  'admin.users.empty': 'Aucun utilisateur.',
  'admin.users.columns.name': 'Nom',
  'admin.users.columns.email': 'Email',
  'admin.users.columns.organizations': 'Organisations',
  'admin.users.columns.status': 'Statut',
  'admin.users.columns.role': 'Rôle plateforme',
  'admin.users.roles.none': 'Aucun',
  'admin.users.roles.admin': 'Administrateur',
  'admin.users.roles.moderator': 'Modérateur',
  'admin.users.roles.label': 'Rôle plateforme du compte',
  'admin.users.unverified': 'Email non vérifié',
  'admin.pagination.previous': 'Précédent',
  'admin.pagination.next': 'Suivant',
}

const get = vi.fn()
const patch = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: {
      get: (...args: unknown[]) => get(...args),
      patch: (...args: unknown[]) => patch(...args),
    },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string) =>
    name === 'admin.users.platform_role.update'
      ? '/fr/admin/users/2/platform-role'
      : '/fr/admin/users',
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Index } = await import('~/pages/admin/users/index.vue')

function user(id: number, extra: Partial<AdminUserListItem> = {}): AdminUserListItem {
  return {
    id,
    email: `user${id}@example.com`,
    fullName: `User ${id}`,
    platformRole: 'none',
    emailVerified: true,
    organizationsCount: 1,
    createdAt: '2026-10-17T10:00:00.000Z',
    ...extra,
  }
}

function render(
  users: AdminUserListItem[],
  lastPage = 1,
  currentPage = 1,
  roles: { canManageRoles: boolean; currentUserId: number } = {
    canManageRoles: false,
    currentUserId: 1,
  }
) {
  return mount(Index, {
    props: {
      users: { data: users, meta: { total: users.length, perPage: 25, currentPage, lastPage } },
      filters: { search: null },
      ...roles,
    },
  })
}

describe('admin/users/index', () => {
  beforeEach(() => {
    get.mockClear()
    patch.mockClear()
  })

  it('affiche les comptes avec la pastille de rôle plateforme et non vérifié', () => {
    const wrapper = render([
      user(1, { platformRole: 'admin' }),
      user(2, { emailVerified: false }),
      user(3),
    ])

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('Administrateur')
    expect(rows[1].text()).toContain('Email non vérifié')
    expect(rows[2].text()).not.toContain('Administrateur')
  })

  it('sans le droit roles.manage, le rôle est affiché en lecture seule', () => {
    const wrapper = render([user(1), user(2, { platformRole: 'moderator' })])

    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')[1].text()).toContain('Modérateur')
  })

  it('avec le droit roles.manage, un select par compte — sauf le sien', () => {
    const wrapper = render([user(1, { platformRole: 'admin' }), user(2)], 1, 1, {
      canManageRoles: true,
      currentUserId: 1,
    })

    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].find('select').exists()).toBe(false)
    expect(rows[0].text()).toContain('Administrateur')
    expect(rows[1].find('select').exists()).toBe(true)
  })

  it('changer le select envoie un PATCH avec le nouveau rôle', async () => {
    const wrapper = render([user(1, { platformRole: 'admin' }), user(2)], 1, 1, {
      canManageRoles: true,
      currentUserId: 1,
    })

    await wrapper.findAll('tbody tr')[1].find('select').setValue('moderator')

    expect(patch).toHaveBeenCalledWith(
      '/fr/admin/users/2/platform-role',
      { platformRole: 'moderator' },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('affiche l’état vide', () => {
    const wrapper = render([])
    expect(wrapper.text()).toContain('Aucun utilisateur.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('pagine : « Suivant » demande la page suivante en conservant la recherche', async () => {
    const wrapper = render([user(1)], 3, 1)

    const next = wrapper.findAll('button').find((button) => button.text() === 'Suivant')
    await next!.trigger('click')

    expect(get).toHaveBeenCalledWith(
      '/fr/admin/users',
      { search: undefined, page: 2 },
      expect.objectContaining({ only: ['users', 'filters'] })
    )
  })

  it('masque le pager quand il n’y a qu’une page', () => {
    expect(render([user(1)]).findAll('button')).toHaveLength(0)
  })
})
