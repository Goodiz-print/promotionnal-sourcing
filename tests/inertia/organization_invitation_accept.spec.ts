import { describe, it, expect, vi } from 'vitest'
import { reactive } from 'vue'
import { mount } from '@vue/test-utils'
import type { OrganizationInvitationPreviewType } from '#shared/types/organization'

const translations = {
  'organization.invitations.accept.title': 'Invitation à rejoindre une organisation',
  'organization.invitations.accept.description':
    'Vous êtes invité(e) à rejoindre {organization} avec le rôle {role}.',
  'organization.invitations.accept.submit': "Accepter l'invitation",
  'organization.invitations.accept.login': 'Se connecter',
  'organization.invitations.accept.signup': 'Créer un compte',
  'organization.invitations.accept.wrongAccount':
    'Vous êtes connecté(e) avec {email}, mais cette invitation est destinée à une autre adresse.',
  'organization.invitations.accept.loginAsInvited':
    'Se déconnecter et se connecter avec la bonne adresse',
}

vi.mock('@inertiajs/vue3', () => ({
  usePage: () => ({ props: { locale: 'fr', supportedLocales: ['fr', 'en'], translations } }),
  useForm: (data: Record<string, unknown>) =>
    reactive({
      ...data,
      errors: {},
      processing: false,
      post: vi.fn(),
    }),
  Head: { render: () => null },
}))
vi.mock('@adonisjs/inertia/vue', () => ({ Link: { template: '<a><slot /></a>' } }))

const { default: InvitationAccept } = await import('~/pages/organization/invitation_accept.vue')

const invitation: OrganizationInvitationPreviewType = {
  id: 1,
  organizationName: 'Acme',
  roleName: 'Membre',
  invitedByName: 'Alice',
  email: 'invited@example.com',
}

describe('organization/invitation_accept.vue', () => {
  it('propose de se connecter/inscrire quand personne n’est connecté', () => {
    const wrapper = mount(InvitationAccept, {
      props: {
        invitation,
        currentUserEmail: null,
        acceptActionUrl: '/fr/organization/invitations/1/accept?signature=abc',
        loginUrl: '/fr/login?redirect=%2Ffr%2Forganization%2Finvitations%2F1%2Faccept',
        signupUrl: '/fr/signup?redirect=%2Ffr%2Forganization%2Finvitations%2F1%2Faccept',
      },
    })

    expect(wrapper.text()).toContain('Se connecter')
    expect(wrapper.text()).toContain('Créer un compte')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it("affiche le bouton accepter quand l'email connecté correspond", () => {
    const wrapper = mount(InvitationAccept, {
      props: {
        invitation,
        currentUserEmail: 'invited@example.com',
        acceptActionUrl: '/fr/organization/invitations/1/accept?signature=abc',
        loginUrl: '/fr/login',
        signupUrl: '/fr/signup',
      },
    })

    expect(wrapper.text()).toContain("Accepter l'invitation")
  })

  it("affiche un message si l'email connecté ne correspond pas", () => {
    const wrapper = mount(InvitationAccept, {
      props: {
        invitation,
        currentUserEmail: 'someone-else@example.com',
        acceptActionUrl: '/fr/organization/invitations/1/accept?signature=abc',
        loginUrl: '/fr/login',
        signupUrl: '/fr/signup',
      },
    })

    expect(wrapper.text()).toContain('someone-else@example.com')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
