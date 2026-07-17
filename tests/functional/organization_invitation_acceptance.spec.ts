import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { signedUrlFor } from '@adonisjs/core/services/url_builder'
import RoleSeeder from '#database/seeders/role_seeder'
import PermissionSeeder from '#database/seeders/permission_seeder'
import RolePermissionSeeder from '#database/seeders/role_permission_seeder'
import User from '#models/user'
import Role from '#models/role'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import OrganizationInvitation from '#models/organization_invitation'

async function makeOwner(email: string, org: Organization): Promise<User> {
  const role = await Role.findByOrFail('slug', 'owner')
  const user = await User.create({ email, password: 'password123', fullName: 'Owner' })
  await OrganizationUser.create({ userId: user.id, organizationId: org.id, roleId: role.id })
  await user.merge({ currentOrganizationId: org.id }).save()
  return user
}

async function makeInvitation(
  org: Organization,
  email: string,
  overrides: Partial<{ status: 'pending' | 'accepted' | 'revoked'; expiresAt: DateTime }> = {}
): Promise<OrganizationInvitation> {
  const role = await Role.findByOrFail('slug', 'member')
  return OrganizationInvitation.create({
    organizationId: org.id,
    email,
    roleId: role.id,
    status: overrides.status ?? 'pending',
    expiresAt: overrides.expiresAt ?? DateTime.now().plus({ days: 7 }),
  })
}

function acceptUrl(id: number): string {
  return signedUrlFor(
    'organization.invitations.show',
    { locale: 'fr', id },
    { expiresIn: '7d', purpose: 'organization-invitation' }
  )
}

test.group('Acceptation d’une invitation', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(async () => {
    await new RoleSeeder(db.connection()).run()
    await new PermissionSeeder(db.connection()).run()
    await new RolePermissionSeeder(db.connection()).run()
  })

  test('affiche un aperçu pour un lien valide (non connecté)', async ({ client }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    await makeOwner('owner@example.com', org)
    const invitation = await makeInvitation(org, 'invited@example.com')

    const response = await client.get(acceptUrl(invitation.id)).withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('organization/invitation_accept')
    response.assertInertiaPropsContains({
      invitation: { organizationName: 'Acme', email: 'invited@example.com' },
      currentUserEmail: null,
    })
  })

  test('un lien avec signature invalide affiche la page invitation_invalid', async ({ client }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const invitation = await makeInvitation(org, 'invited@example.com')

    const response = await client
      .get(`/fr/organization/invitations/${invitation.id}/accept?signature=invalid`)
      .withInertia()

    response.assertStatus(200)
    response.assertInertiaComponent('organization/invitation_invalid')
  })

  test('une invitation déjà acceptée affiche invitation_invalid', async ({ client }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const invitation = await makeInvitation(org, 'invited@example.com', { status: 'accepted' })

    const response = await client.get(acceptUrl(invitation.id)).withInertia()

    response.assertInertiaComponent('organization/invitation_invalid')
  })

  test('une invitation expirée (défensif, hors signature) affiche invitation_invalid', async ({
    client,
  }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const invitation = await makeInvitation(org, 'invited@example.com', {
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    const response = await client.get(acceptUrl(invitation.id)).withInertia()

    response.assertInertiaComponent('organization/invitation_invalid')
  })

  test("l'invité accepte et rejoint l'organisation", async ({ client, assert }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    await makeOwner('owner@example.com', org)
    const invitation = await makeInvitation(org, 'invited@example.com')
    const invitee = await User.create({
      email: 'invited@example.com',
      password: 'password123',
      fullName: 'Invitee',
    })

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

  test('un utilisateur connecté avec un autre email ne peut pas accepter', async ({
    client,
    assert,
  }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    await makeOwner('owner@example.com', org)
    const invitation = await makeInvitation(org, 'invited@example.com')
    const someoneElse = await User.create({
      email: 'someone-else@example.com',
      password: 'password123',
      fullName: 'Someone Else',
    })

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
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const invitation = await makeInvitation(org, 'invited@example.com')

    const response = await client.post(acceptUrl(invitation.id)).withCsrfToken().redirects(0)

    response.assertStatus(302)
  })
})

test.group(
  'Redirection après connexion/inscription (préservation du lien d’invitation)',
  (group) => {
    group.each.setup(() => testUtils.db().truncate())
    group.each.setup(async () => {
      await new RoleSeeder(db.connection()).run()
      await new PermissionSeeder(db.connection()).run()
      await new RolePermissionSeeder(db.connection()).run()
    })

    test('login redirige vers le paramètre redirect fourni (chemin sûr)', async ({ client }) => {
      await User.create({
        email: 'user@example.com',
        password: 'password123',
        fullName: 'User',
      })

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
      await User.create({
        email: 'user@example.com',
        password: 'password123',
        fullName: 'User',
      })

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
