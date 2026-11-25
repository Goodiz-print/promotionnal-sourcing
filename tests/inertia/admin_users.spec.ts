import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { answerConfirm, mountConfirmHost } from './support/confirm_dialog'
import type { AdminUserListItem } from '#shared/types/admin'
import type { AdminUserDetail, AdminUserIndexFilters } from '#shared/types/admin_user'

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
  'admin.users.filters.platformRole': 'Rôle plateforme',
  'admin.users.filters.status': 'Statut',
  'admin.users.filters.all': 'Tous',
  'admin.users.filters.anyRole': 'Tout rôle',
  'admin.users.filters.suspended': 'Suspendu',
  'admin.users.filters.active': 'Actif',
  'admin.trade.filters.apply': 'Filtrer',
  'admin.users.show.suspended': 'Suspendu',
  'admin.users.show.never': 'Jamais',
  'admin.users.show.back': 'Retour',
  'admin.users.show.identity': 'Identité',
  'admin.users.show.organizations': 'Organisations',
  'admin.users.show.passkeys': 'Passkeys',
  'admin.users.show.consents': 'Consentements légaux',
  'admin.users.show.actions': 'Actions',
  'admin.users.show.archivedOrg': 'Archivée',
  'admin.users.show.anonymized': 'Compte anonymisé',
  'admin.users.actions.suspend.label': 'Suspendre',
  'admin.users.actions.suspend.confirm': 'Suspendre ?',
  'admin.users.actions.suspend.reasonLabel': 'Motif',
  'admin.users.actions.reactivate.label': 'Réactiver',
  'admin.users.actions.reactivate.confirm': 'Réactiver ?',
  'admin.users.actions.resendVerification.label': 'Renvoyer la vérification',
  'admin.users.actions.resendVerification.confirm': 'Renvoyer ?',
  'admin.users.actions.passwordReset.label': 'Réinitialiser le mot de passe',
  'admin.users.actions.passwordReset.confirm': 'Réinitialiser ?',
  'admin.users.actions.destroy.label': 'Supprimer le compte',
  'admin.users.actions.destroy.confirm': 'Supprimer ?',
  'admin.organizations.types.supplier': 'Fournisseur',
  'admin.organizations.roles.owner': 'Propriétaire',
  'admin.pagination.previous': 'Précédent',
  'admin.pagination.next': 'Suivant',
}

const get = vi.fn()
const patch = vi.fn()
const post = vi.fn()
const del = vi.fn()

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: {
      get: (...args: unknown[]) => get(...args),
      patch: (...args: unknown[]) => patch(...args),
      post: (...args: unknown[]) => post(...args),
      delete: (...args: unknown[]) => del(...args),
    },
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({
  urlFor: (name: string, params?: { id?: number }) =>
    name === 'admin.users.platform_role.update'
      ? '/fr/admin/users/2/platform-role'
      : name === 'admin.users.index'
        ? '/fr/admin/users'
        : `/fr/${name}/${params?.id}`,
}))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Index } = await import('~/pages/admin/users/index.vue')
const { default: Show } = await import('~/pages/admin/users/show.vue')

function user(id: number, extra: Partial<AdminUserListItem> = {}): AdminUserListItem {
  return {
    id,
    email: `user${id}@example.com`,
    fullName: `User ${id}`,
    platformRole: 'none',
    emailVerified: true,
    organizationsCount: 1,
    lastLoginAt: null,
    suspendedAt: null,
    createdAt: '2026-10-17T10:00:00.000Z',
    ...extra,
  }
}

const NO_FILTERS: AdminUserIndexFilters = {
  search: null,
  platformRole: null,
  emailVerified: null,
  activity: null,
  organizationType: null,
  status: null,
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
      filters: NO_FILTERS,
      filterOptions: {
        platformRoles: ['admin', 'moderator', 'any-role'],
        organizationTypes: ['buyer', 'supplier'],
      },
      canSupport: true,
      canManage: true,
      ...roles,
    },
  })
}

describe('admin/users/index', () => {
  beforeEach(() => {
    get.mockClear()
    patch.mockClear()
    post.mockClear()
    del.mockClear()
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

    expect(wrapper.find('tbody select').exists()).toBe(false)
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
      { page: 2 },
      expect.objectContaining({ only: ['users', 'filters'] })
    )
  })

  it('masque le pager quand il n’y a qu’une page', () => {
    const buttons = render([user(1)]).findAll('button')
    expect(buttons.map((b) => b.text())).not.toContain('Suivant')
  })

  it('affiche le badge suspendu, la dernière connexion et le lien vers la fiche', () => {
    const wrapper = render([
      user(1, { suspendedAt: '2026-10-20T10:00:00.000Z' }),
      user(2, { lastLoginAt: '2026-10-18T10:00:00.000Z' }),
    ])
    const rows = wrapper.findAll('tbody tr')

    expect(rows[0].text()).toContain('Suspendu')
    expect(rows[0].text()).toContain('Jamais')
    expect(rows[1].text()).not.toContain('Jamais')
    expect(rows[0].find('a').attributes('href')).toBe('/fr/admin.users.show/1')
  })

  it('le formulaire de filtres émet une visite avec les filtres actifs seulement', async () => {
    const wrapper = render([user(1)])

    await wrapper.find('#user-platform-role').setValue('any-role')
    await wrapper.find('#user-status').setValue('suspended')
    await wrapper.find('form').trigger('submit')

    expect(get).toHaveBeenCalledWith(
      '/fr/admin/users',
      { page: 1, platformRole: 'any-role', status: 'suspended' },
      expect.objectContaining({ preserveState: true, only: ['users', 'filters'] })
    )
  })

  it('resynchronise les champs quand les filtres du serveur changent', async () => {
    const wrapper = render([user(1)])
    await wrapper.setProps({ filters: { ...NO_FILTERS, activity: 'never' } })

    expect((wrapper.find('#user-activity').element as HTMLSelectElement).value).toBe('never')
  })
})

function detail(extra: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: 7,
    email: 'jane@example.com',
    fullName: 'Jane Doe',
    firstName: 'Jane',
    lastName: 'Doe',
    civility: null,
    platformRole: 'none',
    emailVerified: true,
    locale: 'fr',
    createdAt: '2026-10-17T10:00:00.000Z',
    lastLoginAt: null,
    suspendedAt: null,
    organizations: [
      {
        id: 1,
        name: 'Acme',
        slug: 'acme',
        organizationType: 'supplier',
        roleSlug: 'owner',
        archivedAt: null,
      },
    ],
    passkeys: [],
    consents: [],
    canSupport: true,
    canManage: true,
    isSelf: false,
    ...extra,
  }
}

const mountShow = (account: AdminUserDetail) =>
  mount(Show, { props: { account, canManageRoles: false } })
const labels = (wrapper: ReturnType<typeof mountShow>) =>
  wrapper.findAll('button').map((button) => button.text())

describe('admin/users/show', () => {
  beforeEach(() => {
    post.mockClear()
    del.mockClear()
  })

  it('affiche le titre, les sections et les organisations', () => {
    const wrapper = mountShow(detail({ emailVerified: false }))

    expect(wrapper.find('h1').text()).toBe('Jane Doe')
    expect(wrapper.text()).toContain('Identité')
    expect(wrapper.text()).toContain('Acme')
    expect(wrapper.text()).toContain('Fournisseur')
    expect(wrapper.text()).toContain('Propriétaire')
    expect(wrapper.text()).toContain('Passkeys')
    expect(wrapper.text()).toContain('Consentements légaux')
    expect(wrapper.text()).toContain('Email non vérifié')
    expect(wrapper.text()).toContain('Jamais')
  })

  it('support seul : vérification et reset, pas de suspension ni suppression', () => {
    const wrapper = mountShow(detail({ canManage: false, emailVerified: false }))

    expect(labels(wrapper)).toEqual(['Renvoyer la vérification', 'Réinitialiser le mot de passe'])
  })

  it('renvoi de vérification masqué si l’email est vérifié', () => {
    expect(labels(mountShow(detail()))).not.toContain('Renvoyer la vérification')
  })

  it('sur son propre compte, suspendre et supprimer sont masqués', () => {
    const wrapper = mountShow(detail({ isSelf: true }))

    expect(labels(wrapper)).toEqual(['Réinitialiser le mot de passe'])
  })

  it('compte suspendu : propose de réactiver, pas de suspendre', () => {
    const wrapper = mountShow(detail({ suspendedAt: '2026-10-20T10:00:00.000Z' }))

    expect(labels(wrapper)).toContain('Réactiver')
    expect(labels(wrapper)).not.toContain('Suspendre')
    expect(wrapper.text()).toContain('Suspendu')
  })

  it('compte anonymisé : plus aucune action', () => {
    const wrapper = mountShow(detail({ email: 'deleted-7@promotionnal-sourcing.invalid' }))

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).toContain('Compte anonymisé')
  })

  it('confirm refusé : aucune requête', async () => {
    const host = await mountConfirmHost()
    const wrapper = mountShow(detail())

    for (const button of wrapper.findAll('button')) {
      await button.trigger('click')
      await answerConfirm(host, 'cancel')
    }

    expect(post).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('suspendre envoie le motif saisi', async () => {
    const host = await mountConfirmHost()
    const wrapper = mountShow(detail())

    await wrapper.find('#suspend-reason').setValue('  Fraude  ')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Suspendre')!
      .trigger('click')
    expect(host.find('#confirm-dialog-message').text()).toBe('Suspendre ?')
    expect(host.find('[data-confirm-dialog="confirm"]').text()).toBe('Suspendre')
    await answerConfirm(host, 'confirm')

    expect(post).toHaveBeenCalledWith(
      '/fr/admin.users.suspend/7',
      { reason: 'Fraude' },
      expect.objectContaining({ preserveScroll: true })
    )
  })

  it('supprimer confirmé envoie un DELETE', async () => {
    const host = await mountConfirmHost()
    const wrapper = mountShow(detail())

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Supprimer le compte')!
      .trigger('click')
    expect(host.find('#confirm-dialog-message').text()).toBe('Supprimer ?')
    expect(host.find('[data-confirm-dialog="confirm"]').classes()).toContain('text-danger')
    await answerConfirm(host, 'confirm')

    expect(del).toHaveBeenCalledWith(
      '/fr/admin.users.destroy/7',
      expect.objectContaining({ preserveScroll: true })
    )
  })
})
