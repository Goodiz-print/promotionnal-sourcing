import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import { mount } from '@vue/test-utils'
import type { OrganizationMemberType } from '#shared/types/organization'
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
}

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({ props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations } }),
  router: { patch: vi.fn(), delete: vi.fn() },
  useForm: (data: Record<string, unknown>) =>
    reactive({
      ...data,
      errors: {},
      processing: false,
      transform() {
        return this
      },
      reset: vi.fn(),
      post: vi.fn(),
    }),
  Head: { render: () => null },
}))
vi.mock('~/client', () => ({ urlFor: () => '/fr/organization/members' }))
vi.mock('@adonisjs/inertia/vue', () => ({ Link: { template: '<a><slot /></a>' } }))

const { default: Members } = await import('~/pages/organization/members.vue')

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

const roles = [role(1, 'owner', 'Proprietaire'), role(2, 'admin', 'Administrateur')]

describe('organization/members.vue', () => {
  it('liste les membres avec leur rôle', () => {
    const wrapper = mount(Members, {
      props: {
        members: [
          member(1, 'owner@example.com', roles[0]),
          member(2, 'admin@example.com', roles[1]),
        ],
        roles,
        canManageMembers: true,
      },
    })

    expect(wrapper.text()).toContain('owner@example.com')
    expect(wrapper.text()).toContain('admin@example.com')
    expect(wrapper.findAll('select')).toHaveLength(2)
  })

  it('masque le select de rôle et le bouton retirer sans canManageMembers', () => {
    const wrapper = mount(Members, {
      props: {
        members: [member(1, 'owner@example.com', roles[0])],
        roles,
        canManageMembers: false,
      },
    })

    expect(wrapper.findAll('select')).toHaveLength(0)
    expect(wrapper.findAll('button').filter((b) => b.text() === 'Retirer')).toHaveLength(0)
  })

  it('affiche un bouton retirer par membre', () => {
    const wrapper = mount(Members, {
      props: {
        members: [
          member(1, 'owner@example.com', roles[0]),
          member(2, 'admin@example.com', roles[1]),
        ],
        roles,
        canManageMembers: true,
      },
    })

    const buttons = wrapper.findAll('button').filter((b) => b.text() === 'Retirer')
    expect(buttons).toHaveLength(2)
  })
})
