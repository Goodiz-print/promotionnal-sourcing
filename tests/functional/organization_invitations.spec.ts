import { test } from '@japa/runner'
import env from '#start/env'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import Role from '#models/role'
import type Organization from '#models/organization'
import OrganizationInvitation from '#models/organization_invitation'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'
import OrganizationInvitationsService from '#services/organization_invitations_service'
import type { InvitationStatus } from '#shared/types/organization'
import app from '@adonisjs/core/services/app'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

test.group('Invitations de membres par email', (group) => {
  useDatabase(group)
  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })

  test('un owner invite un nouveau membre par email (mail envoyé via la queue)', async ({
    client,
    assert,
  }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await createMember(org, 'owner', { email: 'owner@example.com' })
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

    fakeMailer.mails.assertSent(
      OrganizationInvitationNotification,
      (m) => (m as unknown as { email: string }).email === 'invited@example.com'
    )
    // Lien absolu (#288) : ouvert depuis une messagerie, il doit porter le domaine.
    const [sent] = fakeMailer.mails.sent((m) => m instanceof OrganizationInvitationNotification)
    const { acceptUrl } = sent as unknown as { acceptUrl: string }
    const appOrigin = new URL(env.get('APP_URL', 'http://localhost:5555')).origin
    assert.isTrue(acceptUrl.startsWith(`${appOrigin}/fr/organization/invitations/`))
  })

  test('un manager peut inviter (canInviteMembers)', async ({ client, assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const manager = await createMember(org, 'manager', { email: 'manager@example.com' })
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
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const member = await createMember(org, 'member', { email: 'member@example.com' })
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
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await createMember(org, 'owner', { email: 'owner@example.com' })
    await createMember(org, 'member', { email: 'already@example.com' }, { asCurrent: false })
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
    fakeMailer.mails.assertNoneSent()
  })

  test('relancer une invitation en attente la rafraîchit sans créer de doublon', async ({
    client,
    assert,
  }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await createMember(org, 'owner', { email: 'owner@example.com' })
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
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await createMember(org, 'owner', { email: 'owner@example.com' })
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
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await createMember(org, 'owner', { email: 'owner@example.com' })
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

    fakeMailer.mails.assertSent(
      OrganizationInvitationNotification,
      (m) => (m as unknown as { email: string }).email === 'invited@example.com'
    )
  })

  test('renvoyer une invitation révoquée est refusé', async ({ client, assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await createMember(org, 'owner', { email: 'owner@example.com' })
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
    fakeMailer.mails.assertNoneSent()
  })

  test("renvoyer l'invitation d'une autre organisation renvoie 404", async ({ client, assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const other = await OrganizationFactory.merge({ name: 'Other', slug: 'other' }).create()
    const owner = await createMember(org, 'owner', { email: 'owner@example.com' })
    const otherOwner = await createMember(other, 'owner', { email: 'other-owner@example.com' })
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
    fakeMailer.mails.assertNoneSent()
    await invitation.refresh()
    assert.equal(invitation.status, 'pending')
  })

  test('un membre simple ne peut pas renvoyer une invitation', async ({ client, assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await createMember(
      org,
      'owner',
      { email: 'owner@example.com' },
      { asCurrent: false }
    )
    const member = await createMember(org, 'member', { email: 'member@example.com' })
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

    fakeMailer.mails.assertNoneSent()
    await invitation.refresh()
    assert.isTrue(invitation.expiresAt < DateTime.now())
  })

  test("l'écran membres liste les invitations en attente et expose canManageMembers", async ({
    client,
  }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await createMember(org, 'owner', { email: 'owner@example.com' })
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
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const manager = await createMember(org, 'manager', { email: 'manager@example.com' })

    const response = await client.get('/fr/organization/members').withInertia().loginAs(manager)

    response.assertStatus(200)
    response.assertInertiaPropsContains({ canManageMembers: false })
  })
})

test.group('Purge des invitations expirées', (group) => {
  useDatabase(group)

  async function makeInvitation(
    org: Organization,
    email: string,
    attrs: Partial<{ status: InvitationStatus; expiresAt: DateTime }> = {}
  ): Promise<OrganizationInvitation> {
    const role = await Role.findByOrFail('slug', 'member')
    return OrganizationInvitation.create({
      organizationId: org.id,
      email,
      roleId: role.id,
      status: 'pending',
      expiresAt: DateTime.now().plus({ days: 7 }),
      ...attrs,
    })
  }

  test('bascule en `expired` les invitations échues, sans toucher aux autres', async ({
    assert,
  }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const outdated = await makeInvitation(org, 'outdated@example.com', {
      expiresAt: DateTime.now().minus({ days: 1 }),
    })
    const stillValid = await makeInvitation(org, 'valid@example.com')
    const accepted = await makeInvitation(org, 'accepted@example.com', {
      status: 'accepted',
      expiresAt: DateTime.now().minus({ days: 30 }),
    })

    const service = await app.container.make(OrganizationInvitationsService)
    const result = await service.purgeExpired()

    assert.deepEqual(result, { expired: 1, deleted: 0 })
    await outdated.refresh()
    await stillValid.refresh()
    await accepted.refresh()
    assert.equal(outdated.status, 'expired')
    assert.equal(stillValid.status, 'pending')
    assert.equal(accepted.status, 'accepted')
  })

  test('supprime les invitations terminales passé le délai de rétention, garde les acceptées', async ({
    assert,
  }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const revoked = await makeInvitation(org, 'revoked@example.com', { status: 'revoked' })
    const accepted = await makeInvitation(org, 'accepted@example.com', { status: 'accepted' })

    // 91 jours plus tard : les deux invitations dépassent la rétention (90 j),
    // seule celle en état terminal non-acceptée doit disparaître.
    const service = await app.container.make(OrganizationInvitationsService)
    const result = await service.purgeExpired(DateTime.now().plus({ days: 91 }))

    assert.equal(result.deleted, 1)
    assert.isNull(await OrganizationInvitation.find(revoked.id))
    assert.isNotNull(await OrganizationInvitation.find(accepted.id))
  })

  test("une invitation expirée n'apparaît plus dans l'écran membres", async ({
    client,
    assert,
  }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await createMember(org, 'owner', { email: 'owner@example.com' })
    await makeInvitation(org, 'outdated@example.com', {
      expiresAt: DateTime.now().minus({ days: 1 }),
    })

    const service = await app.container.make(OrganizationInvitationsService)
    await service.purgeExpired()

    const response = await client.get('/fr/organization/members').withInertia().loginAs(owner)

    response.assertStatus(200)
    assert.isEmpty(response.inertiaProps.invitations)
  })
})
