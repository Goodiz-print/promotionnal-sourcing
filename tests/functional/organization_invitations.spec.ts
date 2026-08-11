import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import mail from '@adonisjs/mail/services/main'
import testUtils from '@adonisjs/core/services/test_utils'
import RoleSeeder from '#database/seeders/role_seeder'
import PermissionSeeder from '#database/seeders/permission_seeder'
import RolePermissionSeeder from '#database/seeders/role_permission_seeder'
import User from '#models/user'
import Role from '#models/role'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import OrganizationInvitation from '#models/organization_invitation'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'

async function makeMember(
  email: string,
  org: Organization,
  roleSlug: string,
  { asCurrent = true }: { asCurrent?: boolean } = {}
): Promise<User> {
  const role = await Role.findByOrFail('slug', roleSlug)
  const user = await User.create({
    email,
    password: await hash.make('password123'),
    fullName: `Test ${email}`,
  })
  await OrganizationUser.create({ userId: user.id, organizationId: org.id, roleId: role.id })
  if (asCurrent) {
    await user.merge({ currentOrganizationId: org.id }).save()
  }
  return user
}

test.group('Invitations de membres par email', (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(async () => {
    await new RoleSeeder(db.connection()).run()
    await new PermissionSeeder(db.connection()).run()
    await new RolePermissionSeeder(db.connection()).run()
  })
  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  test('un owner invite un nouveau membre par email (mail mis en file)', async ({
    client,
    assert,
  }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const owner = await makeMember('owner@example.com', org, 'owner')
    const memberRole = await Role.findByOrFail('slug', 'member')

    const response = await client
      .post('/fr/organization/invitations')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ email: 'invited@example.com', roleId: memberRole.id })

    response.assertStatus(200)

    const invitation = await OrganizationInvitation.findByOrFail('email', 'invited@example.com')
    assert.equal(invitation.status, 'pending')
    assert.equal(invitation.roleId, memberRole.id)
    assert.equal(invitation.invitedByUserId, owner.id)

    fakeMailer.mails.assertQueued(
      OrganizationInvitationNotification,
      (m) => (m as unknown as { email: string }).email === 'invited@example.com'
    )
  })

  test('un manager peut inviter (canInviteMembers)', async ({ client, assert }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const manager = await makeMember('manager@example.com', org, 'manager')
    const memberRole = await Role.findByOrFail('slug', 'member')

    const response = await client
      .post('/fr/organization/invitations')
      .withInertia()
      .withCsrfToken()
      .loginAs(manager)
      .json({ email: 'invited@example.com', roleId: memberRole.id })

    response.assertStatus(200)
    const invitation = await OrganizationInvitation.findBy('email', 'invited@example.com')
    assert.isNotNull(invitation)
  })

  test('un membre simple ne peut pas inviter', async ({ client, assert }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const member = await makeMember('member@example.com', org, 'member')
    const memberRole = await Role.findByOrFail('slug', 'member')

    // Bouncer redirige (back + flash "error") plutôt qu'un 403 brut pour les
    // requêtes POST/PATCH/DELETE (cf. AuthorizationException#formSubmissionMethods) —
    // on vérifie l'effet réel : aucune invitation créée.
    await client
      .post('/fr/organization/invitations')
      .withInertia()
      .withCsrfToken()
      .loginAs(member)
      .json({ email: 'invited@example.com', roleId: memberRole.id })

    const invitation = await OrganizationInvitation.findBy('email', 'invited@example.com')
    assert.isNull(invitation)
  })

  test('inviter un email déjà membre est rejeté', async ({ client, assert }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const owner = await makeMember('owner@example.com', org, 'owner')
    await makeMember('already@example.com', org, 'member', { asCurrent: false })
    const memberRole = await Role.findByOrFail('slug', 'member')

    const response = await client
      .post('/fr/organization/invitations')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ email: 'already@example.com', roleId: memberRole.id })

    response.assertStatus(200)
    const invitation = await OrganizationInvitation.findBy('email', 'already@example.com')
    assert.isNull(invitation)
    fakeMailer.mails.assertNoneQueued()
  })

  test('relancer une invitation en attente la rafraîchit sans créer de doublon', async ({
    client,
    assert,
  }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const owner = await makeMember('owner@example.com', org, 'owner')
    const memberRole = await Role.findByOrFail('slug', 'member')
    const adminRole = await Role.findByOrFail('slug', 'admin')

    await client
      .post('/fr/organization/invitations')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ email: 'invited@example.com', roleId: memberRole.id })

    await client
      .post('/fr/organization/invitations')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ email: 'invited@example.com', roleId: adminRole.id })

    const invitations = await OrganizationInvitation.query().where('email', 'invited@example.com')
    assert.lengthOf(invitations, 1)
    assert.equal(invitations[0].roleId, adminRole.id)
  })

  test('un owner révoque une invitation en attente', async ({ client, assert }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const owner = await makeMember('owner@example.com', org, 'owner')
    const memberRole = await Role.findByOrFail('slug', 'member')

    await client
      .post('/fr/organization/invitations')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ email: 'invited@example.com', roleId: memberRole.id })

    const invitation = await OrganizationInvitation.findByOrFail('email', 'invited@example.com')

    const response = await client
      .delete(`/fr/organization/invitations/${invitation.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(200)
    await invitation.refresh()
    assert.equal(invitation.status, 'revoked')
  })

  test('renvoyer une invitation prolonge son expiration et remet le mail en file', async ({
    client,
    assert,
  }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const owner = await makeMember('owner@example.com', org, 'owner')
    const memberRole = await Role.findByOrFail('slug', 'member')

    await client
      .post('/fr/organization/invitations')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ email: 'invited@example.com', roleId: memberRole.id })

    const invitation = await OrganizationInvitation.findByOrFail('email', 'invited@example.com')
    // Expiration reculée dans le passé proche pour vérifier qu'elle est bien
    // recalculée (et non simplement laissée en place).
    invitation.expiresAt = DateTime.now().minus({ days: 1 })
    await invitation.save()
    fakeMailer.mails.clear()

    const response = await client
      .post(`/fr/organization/invitations/${invitation.id}/resend`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(200)

    await invitation.refresh()
    assert.equal(invitation.status, 'pending')
    assert.isTrue(invitation.expiresAt > DateTime.now())
    assert.lengthOf(await OrganizationInvitation.query().where('email', 'invited@example.com'), 1)

    fakeMailer.mails.assertQueued(
      OrganizationInvitationNotification,
      (m) => (m as unknown as { email: string }).email === 'invited@example.com'
    )
  })

  test('renvoyer une invitation révoquée est refusé', async ({ client, assert }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const owner = await makeMember('owner@example.com', org, 'owner')
    const memberRole = await Role.findByOrFail('slug', 'member')

    const invitation = await OrganizationInvitation.create({
      organizationId: org.id,
      email: 'invited@example.com',
      roleId: memberRole.id,
      invitedByUserId: owner.id,
      status: 'revoked',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })
    fakeMailer.mails.clear()

    const response = await client
      .post(`/fr/organization/invitations/${invitation.id}/resend`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(200)
    await invitation.refresh()
    assert.equal(invitation.status, 'revoked')
    fakeMailer.mails.assertNoneQueued()
  })

  test("renvoyer l'invitation d'une autre organisation renvoie 404", async ({ client, assert }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const other = await Organization.create({ name: 'Other', slug: 'other', country: 'FR' })
    const owner = await makeMember('owner@example.com', org, 'owner')
    const otherOwner = await makeMember('other-owner@example.com', other, 'owner')
    const memberRole = await Role.findByOrFail('slug', 'member')

    const invitation = await OrganizationInvitation.create({
      organizationId: other.id,
      email: 'invited@example.com',
      roleId: memberRole.id,
      invitedByUserId: otherOwner.id,
      status: 'pending',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })
    fakeMailer.mails.clear()

    const response = await client
      .post(`/fr/organization/invitations/${invitation.id}/resend`)
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(404)
    fakeMailer.mails.assertNoneQueued()
    await invitation.refresh()
    assert.equal(invitation.status, 'pending')
  })

  test('un membre simple ne peut pas renvoyer une invitation', async ({ client, assert }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const owner = await makeMember('owner@example.com', org, 'owner', { asCurrent: false })
    const member = await makeMember('member@example.com', org, 'member')
    const memberRole = await Role.findByOrFail('slug', 'member')

    const invitation = await OrganizationInvitation.create({
      organizationId: org.id,
      email: 'invited@example.com',
      roleId: memberRole.id,
      invitedByUserId: owner.id,
      status: 'pending',
      expiresAt: DateTime.now().minus({ days: 1 }),
    })
    fakeMailer.mails.clear()

    await client
      .post(`/fr/organization/invitations/${invitation.id}/resend`)
      .withInertia()
      .withCsrfToken()
      .loginAs(member)

    fakeMailer.mails.assertNoneQueued()
    await invitation.refresh()
    assert.isTrue(invitation.expiresAt < DateTime.now())
  })

  test("l'écran membres liste les invitations en attente et expose canManageMembers", async ({
    client,
  }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const owner = await makeMember('owner@example.com', org, 'owner')
    const memberRole = await Role.findByOrFail('slug', 'member')

    await client
      .post('/fr/organization/invitations')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)
      .json({ email: 'invited@example.com', roleId: memberRole.id })

    const response = await client.get('/fr/organization/members').withInertia().loginAs(owner)

    response.assertStatus(200)
    response.assertInertiaPropsContains({
      canManageMembers: true,
      invitations: [{ email: 'invited@example.com', status: 'pending' }],
    })
  })

  test("un manager voit l'écran membres mais sans les droits de gestion", async ({ client }) => {
    const org = await Organization.create({ name: 'Acme', slug: 'acme', country: 'FR' })
    const manager = await makeMember('manager@example.com', org, 'manager')

    const response = await client.get('/fr/organization/members').withInertia().loginAs(manager)

    response.assertStatus(200)
    response.assertInertiaPropsContains({ canManageMembers: false })
  })
})
