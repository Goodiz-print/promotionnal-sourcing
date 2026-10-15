import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import { signedUrlFor } from '@adonisjs/core/services/url_builder'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { OrganizationInvitationFactory } from '#database/factories/organization_invitation_factory'
import { UserFactory } from '#database/factories/user_factory'
import OrganizationUser from '#models/organization_user'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

function acceptUrl(id: number): string {
  return signedUrlFor(
    'organization.invitations.show',
    { locale: 'fr', id },
    { expiresIn: '7d', purpose: 'organization-invitation' }
  )
}

test.group('Acceptation d’une invitation', (group) => {
  useDatabase(group)

  test('affiche un aperçu pour un lien valide (non connecté)', async ({ client }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    await createMember(org, 'owner', { email: 'owner@example.com' })
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: org.id,
      email: 'invited@example.com',
    }).create()

    const response = await client.get(acceptUrl(invitation.id)).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('organization/invitation_accept')
    response.assertInertiaPropsContains({
      invitation: { organizationName: 'Acme', email: 'invited@example.com' },
      currentUserEmail: null,
    })
  })

  test('un lien avec signature invalide affiche la page invitation_invalid', async ({ client }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: org.id,
      email: 'invited@example.com',
    }).create()

    const response = await client
      .get(`/fr/organization/invitations/${invitation.id}/accept?signature=invalid`)
      .withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('organization/invitation_invalid')
  })

  test('une invitation déjà acceptée affiche invitation_invalid', async ({ client }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const invitation = await OrganizationInvitationFactory.apply('accepted')
      .merge({ organizationId: org.id, email: 'invited@example.com' })
      .create()

    const response = await client.get(acceptUrl(invitation.id)).withInertia()

    response.assertInertiaComponent('organization/invitation_invalid')
  })

  test('une invitation expirée (défensif, hors signature) affiche invitation_invalid', async ({
    client,
  }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: org.id,
      email: 'invited@example.com',
      expiresAt: DateTime.now().minus({ days: 1 }),
    }).create()

    const response = await client.get(acceptUrl(invitation.id)).withInertia()

    response.assertInertiaComponent('organization/invitation_invalid')
  })

  test("l'invité accepte et rejoint l'organisation", async ({ client, assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    await createMember(org, 'owner', { email: 'owner@example.com' })
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: org.id,
      email: 'invited@example.com',
    }).create()
    const invitee = await UserFactory.merge({
      email: 'invited@example.com',
      fullName: 'Invitee',
    }).create()

    const response = await client
      .post(acceptUrl(invitation.id))
      .withInertia()
      .withCsrfToken()
      .loginAs(invitee)

    response.assertStatus(200)

    const membership = await OrganizationUser.query()
      .where('organizationId', org.id)
      .where('userId', invitee.id)
      .first()
    assert.isNotNull(membership)

    await invitee.refresh()
    assert.equal(invitee.currentOrganizationId, org.id)

    await invitation.refresh()
    assert.equal(invitation.status, 'accepted')
  })

  test("un membre d'une autre organisation bascule sur celle qu'il rejoint", async ({
    client,
    assert,
  }) => {
    const acme = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const beta = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()
    await createMember(beta, 'owner', { email: 'owner@example.com' })
    const invitee = await createMember(acme, 'owner', { email: 'invited@example.com' })
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: beta.id,
      email: 'invited@example.com',
    }).create()

    const response = await client
      .post(acceptUrl(invitation.id))
      .withInertia()
      .withCsrfToken()
      .loginAs(invitee)

    response.assertStatus(200)
    // Le flash nomme l'organisation rejointe : la bascule doit être lisible.
    response.assertInertiaPropsContains({ flash: { success: 'Vous avez rejoint Beta.' } })

    await invitee.refresh()
    assert.equal(invitee.currentOrganizationId, beta.id)

    // L'adhésion d'origine reste : basculer n'est pas quitter.
    const memberships = await OrganizationUser.query().where('userId', invitee.id)
    assert.sameMembers(
      memberships.map((membership) => membership.organizationId),
      [acme.id, beta.id]
    )
  })

  test('un utilisateur connecté avec un autre email ne peut pas accepter', async ({
    client,
    assert,
  }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    await createMember(org, 'owner', { email: 'owner@example.com' })
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: org.id,
      email: 'invited@example.com',
    }).create()
    const someoneElse = await UserFactory.merge({
      email: 'someone-else@example.com',
      fullName: 'Someone Else',
    }).create()

    await client.post(acceptUrl(invitation.id)).withInertia().withCsrfToken().loginAs(someoneElse)

    const membership = await OrganizationUser.query()
      .where('organizationId', org.id)
      .where('userId', someoneElse.id)
      .first()
    assert.isNull(membership)

    await invitation.refresh()
    assert.equal(invitation.status, 'pending')
  })

  test('accepter sans être connecté redirige vers la connexion', async ({ client }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: org.id,
      email: 'invited@example.com',
    }).create()

    const response = await client.post(acceptUrl(invitation.id)).withCsrfToken().redirects(0)

    response.assertStatus(302)
  })
})

test.group(
  'Redirection après connexion/inscription (préservation du lien d’invitation)',
  (group) => {
    useDatabase(group)
    // L'inscription met un mail de vérification en queue (driver `sync` en test) :
    // sans faux mailer, il tenterait un vrai SMTP et attendrait son timeout.
    group.each.setup(() => {
      mail.fake()
      return () => mail.restore()
    })

    test('login redirige vers le paramètre redirect fourni (chemin sûr)', async ({ client }) => {
      await UserFactory.merge({ email: 'user@example.com', fullName: 'User' }).create()

      const response = await client
        .post('/fr/login')
        .qs({ redirect: '/fr/organization/settings' })
        .withCsrfToken()
        .redirects(0)
        .json({ email: 'user@example.com', password: 'password123' })

      response.assertStatus(302)
      response.assertHeader('location', '/fr/organization/settings')
    })

    test('login ignore un paramètre redirect non sûr', async ({ client }) => {
      await UserFactory.merge({ email: 'user@example.com', fullName: 'User' }).create()

      const response = await client
        .post('/fr/login')
        .qs({ redirect: 'https://evil.example.com' })
        .withCsrfToken()
        .redirects(0)
        .json({ email: 'user@example.com', password: 'password123' })

      response.assertStatus(302)
      response.assertHeader('location', '/fr/onboarding')
    })

    test('signup redirige vers le paramètre redirect fourni', async ({ client }) => {
      const response = await client
        .post('/fr/signup')
        .qs({ redirect: '/fr/organization/settings' })
        .withCsrfToken()
        .redirects(0)
        .json({
          fullName: 'New User',
          email: 'newuser@example.com',
          password: 'password123',
          passwordConfirmation: 'password123',
        })

      response.assertStatus(302)
      response.assertHeader('location', '/fr/organization/settings')
    })
  }
)
