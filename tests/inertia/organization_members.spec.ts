import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { OrganizationMemberType, OrganizationInvitationType } from '#shared/types/organization'
import type { RoleType } from '#shared/types/role'

const translations = {
  'organization.members.title': "Membres de l'organisation",
  'organization.members.subtitle': 'Sous-titre',
  'organization.members.columns.name': 'Membre',
  'organization.members.columns.role': 'Rôle',
  'organization.members.remove': 'Retirer',
  'organization.members.confirmRemove': 'Retirer ce membre ?',
  'organization.nav.settings': 'Paramètres',
  'organization.nav.members': 'Membres',
  'organization.invitations.inviteTitle': 'Inviter un membre',
  'organization.invitations.emailLabel': 'Email',
  'organization.invitations.roleLabel': 'Rôle',
  'organization.invitations.submit': "Envoyer l'invitation",
  'organization.invitations.pendingTitle': 'Invitations en attente',
  'organization.invitations.revoke': 'Révoquer',
  'organization.invitations.confirmRevoke': 'Révoquer cette invitation ?',
  'organization.invitations.resend': 'Renvoyer',
}

vi.mock('@inertiajs/vue3', async () => {
  const m = await import('./support/inertia_mocks')
  return {
    usePage: () => m.inertiaPage(translations),
    router: { patch: vi.fn(), post: vi.fn(), delete: vi.fn() },
    useForm: m.makeUseForm(),
    Head: m.HeadStub,
  }
})
vi.mock('~/client', () => ({ urlFor: () => '/fr/organization/members' }))
vi.mock('@adonisjs/inertia/vue', async () => {
  const { LinkStub } = await import('./support/inertia_mocks')
  return { Link: LinkStub }
})

const { default: Members } = await import('~/pages/organization/members.vue')
const { router } = await import('@inertiajs/vue3')

function role(id: number, slug: RoleType['slug'], name: string): RoleType {
  return { id, slug, name, description: null }
}

function member(id: number, email: string, roleValue: RoleType): OrganizationMemberType {
  return {
    id,
    fullName: `Test ${id}`,
    email,
    role: roleValue,
    joinedAt: '2026-07-10T00:00:00.000Z',
  }
}

function invitation(id: number, email: string, roleValue: RoleType): OrganizationInvitationType {
  return {
    id,
    email,
    role: roleValue,
    status: 'pending',
    expiresAt: '2026-07-24T00:00:00.000Z',
    createdAt: '2026-07-17T00:00:00.000Z',
  }
}

const roles = [role(1, 'owner', 'Proprietaire'), role(2, 'admin', 'Administrateur')]

describe('organization/members.vue', () => {
  it('liste les membres avec leur rôle (owner/admin)', () => {
    const wrapper = mount(Members, {
      props: {
        members: [
          member(1, 'owner@example.com', roles[0]),
          member(2, 'admin@example.com', roles[1]),
        ],
        invitations: [],
        roles,
        canManageMembers: true,
      },
    })

    expect(wrapper.text()).toContain('owner@example.com')
    expect(wrapper.text()).toContain('admin@example.com')
    expect(wrapper.findAll('select')).toHaveLength(3) // 2 rôles membres + rôle du formulaire d'invitation
  })

  it('masque le select de rôle et le bouton retirer sans canManageMembers', () => {
    const wrapper = mount(Members, {
      props: {
        members: [member(1, 'owner@example.com', roles[0])],
        invitations: [],
        roles,
        canManageMembers: false,
      },
    })

    // Seul le select du formulaire d'invitation reste.
    expect(wrapper.findAll('select')).toHaveLength(1)
    expect(wrapper.findAll('button').filter((b) => b.text() === 'Retirer')).toHaveLength(0)
  })

  it('affiche un bouton retirer par membre', () => {
    const wrapper = mount(Members, {
      props: {
        members: [
          member(1, 'owner@example.com', roles[0]),
          member(2, 'admin@example.com', roles[1]),
        ],
        invitations: [],
        roles,
        canManageMembers: true,
      },
    })

    const buttons = wrapper.findAll('button').filter((b) => b.text() === 'Retirer')
    expect(buttons).toHaveLength(2)
  })

  it('affiche les invitations en attente', () => {
    const wrapper = mount(Members, {
      props: {
        members: [member(1, 'owner@example.com', roles[0])],
        invitations: [invitation(1, 'invited@example.com', roles[1])],
        roles,
        canManageMembers: true,
      },
    })

    expect(wrapper.text()).toContain('Invitations en attente')
    expect(wrapper.text()).toContain('invited@example.com')
  })

  it('renvoie une invitation en attente sans confirmation', async () => {
    const wrapper = mount(Members, {
      props: {
        members: [member(1, 'owner@example.com', roles[0])],
        invitations: [invitation(1, 'invited@example.com', roles[1])],
        roles,
        canManageMembers: true,
      },
    })

    const resendButton = wrapper.findAll('button').filter((b) => b.text() === 'Renvoyer')
    expect(resendButton).toHaveLength(1)

    await resendButton[0].trigger('click')
    expect(router.post).toHaveBeenCalledWith(
      '/fr/organization/members',
      {},
      { preserveScroll: true }
    )
  })

  it("n'affiche pas la section invitations en attente si vide", () => {
    const wrapper = mount(Members, {
      props: {
        members: [member(1, 'owner@example.com', roles[0])],
        invitations: [],
        roles,
        canManageMembers: true,
      },
    })

    expect(wrapper.text()).not.toContain('Invitations en attente')
  })
})
