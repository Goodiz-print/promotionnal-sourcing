import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { OrganizationInvitationFactory } from '#database/factories/organization_invitation_factory'
import { UserFactory } from '#database/factories/user_factory'
import Role from '#models/role'
import SupplierProfile from '#models/supplier_profile'
import AdminAuditLog from '#models/admin_audit_log'
import { createMember, createOrganizationWithOwner } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { AdminOrganizationDetail } from '#shared/types/admin_organization'

interface ListedOrganization {
  id: number
  slug: string
  name: string
  membersCount: number
  organizationType: string
  country: string
}

test.group('Back-office — organisations', (group) => {
  useDatabase(group)

  test('liste par défaut les organisations actives avec leur nombre de membres', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await createOrganizationWithOwner()
    await createMember(organization, 'member')
    const archived = await OrganizationFactory.apply('archived').create()

    const response = await client.get('/fr/admin/organizations').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/organizations/index')
    const listed: ListedOrganization[] = response.inertiaProps.organizationList.data
    assert.equal(listed.find((o) => o.id === organization.id)?.membersCount, 2)
    assert.isUndefined(listed.find((o) => o.id === archived.id))
    assert.equal(response.inertiaProps.filters.status, 'active')
  })

  test('filtre par statut d’archivage', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const active = await OrganizationFactory.create()
    const archived = await OrganizationFactory.apply('archived').create()

    const onlyArchived = await client
      .get('/fr/admin/organizations?status=archived')
      .withInertia()
      .loginAs(admin)
    const all = await client.get('/fr/admin/organizations?status=all').withInertia().loginAs(admin)

    const archivedIds = onlyArchived.inertiaProps.organizationList.data.map(
      (o: { id: number }) => o.id
    )
    const allIds = all.inertiaProps.organizationList.data.map((o: { id: number }) => o.id)
    assert.deepEqual(archivedIds, [archived.id])
    assert.includeMembers(allIds, [active.id, archived.id])
  })

  test('filtre par type d’organisation', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const buyer = await OrganizationFactory.create()
    const supplier = await OrganizationFactory.apply('supplier').create()

    const response = await client
      .get('/fr/admin/organizations?type=supplier')
      .withInertia()
      .loginAs(admin)

    const ids = response.inertiaProps.organizationList.data.map((o: { id: number }) => o.id)
    assert.include(ids, supplier.id)
    assert.notInclude(ids, buyer.id)
    assert.equal(response.inertiaProps.filters.type, 'supplier')
  })

  test('une valeur de filtre inconnue est refusée', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    for (const qs of ['type=nope', 'status=nope']) {
      const response = await client
        .get(`/fr/admin/organizations?${qs}`)
        .header('Accept', 'application/json')
        .loginAs(admin)

      response.assertStatus(422)
    }
  })

  test('la fiche d’une organisation liste ses membres et leur rôle', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization, owner } = await createOrganizationWithOwner()
    const member = await createMember(organization, 'member')

    const response = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/organizations/show')
    const detail = response.inertiaProps.organization
    assert.equal(detail.id, organization.id)
    assert.equal(detail.membersCount, 2)
    assert.deepEqual(
      detail.members.map((m: { email: string; roleSlug: string }) => [m.email, m.roleSlug]).sort(),
      [
        [owner.email, 'owner'],
        [member.email, 'member'],
      ].sort()
    )
  })

  test('la fiche d’une organisation archivée reste consultable', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const archived = await OrganizationFactory.apply('archived').create()

    const response = await client
      .get(`/fr/admin/organizations/${archived.id}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    assert.isNotNull(response.inertiaProps.organization.archivedAt)
  })

  test('une organisation inconnue renvoie 404', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/organizations/999999').withInertia().loginAs(admin)

    response.assertStatus(404)
  })

  test('un utilisateur ordinaire ne voit pas la fiche (403)', async ({ client }) => {
    const { organization, owner } = await createOrganizationWithOwner()

    const response = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(owner)

    response.assertStatus(403)
  })
})

/**
 * Recherche et filtres etendus (#161)
 */
test.group('Gestion organisations - recherche et filtres (#161)', (group) => {
  useDatabase(group)

  test('recherche partielle et insensible a la casse sur le nom', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await OrganizationFactory.merge({ name: 'Acme Corporation' }).create()
    await OrganizationFactory.merge({ name: 'Other Company' }).create()

    const response = await client
      .get('/fr/admin/organizations?search=ACME')
      .withInertia()
      .loginAs(admin)

    const names = response.inertiaProps.organizationList.data.map((o: ListedOrganization) => o.name)
    assert.include(names, target.name)
    assert.notInclude(names, 'Other Company')
    assert.equal(response.inertiaProps.filters.search, 'ACME')
  })

  test('recherche par slug', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await OrganizationFactory.merge({ slug: 'unique-test-slug' }).create()
    await OrganizationFactory.create()

    const response = await client
      .get('/fr/admin/organizations?search=unique-test')
      .withInertia()
      .loginAs(admin)

    const ids = response.inertiaProps.organizationList.data.map((o: ListedOrganization) => o.id)
    assert.include(ids, target.id)
  })

  test('recherche par SIRET', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await OrganizationFactory.merge({ siret: '12345678901234' }).create()
    await OrganizationFactory.create()

    const response = await client
      .get('/fr/admin/organizations?search=12345678901234')
      .withInertia()
      .loginAs(admin)

    const ids = response.inertiaProps.organizationList.data.map((o: ListedOrganization) => o.id)
    assert.deepEqual(ids, [target.id])
  })

  test('recherche par numero de TVA', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const target = await OrganizationFactory.merge({ vatNumber: 'FR12345678901' }).create()
    await OrganizationFactory.create()

    const response = await client
      .get('/fr/admin/organizations?search=FR12345')
      .withInertia()
      .loginAs(admin)

    const ids = response.inertiaProps.organizationList.data.map((o: ListedOrganization) => o.id)
    assert.include(ids, target.id)
  })

  test('les jokers LIKE saisis sont traites litteralement', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await OrganizationFactory.merge({ name: 'Abc Company' }).create()

    const response = await client
      .get('/fr/admin/organizations?search=%25')
      .withInertia()
      .loginAs(admin)

    assert.lengthOf(response.inertiaProps.organizationList.data, 0)
  })

  test('filtre par pays', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const fr = await OrganizationFactory.merge({ country: 'FR' }).create()
    const de = await OrganizationFactory.merge({ country: 'DE' }).create()

    const response = await client
      .get('/fr/admin/organizations?country=FR')
      .withInertia()
      .loginAs(admin)

    const ids = response.inertiaProps.organizationList.data.map((o: ListedOrganization) => o.id)
    assert.include(ids, fr.id)
    assert.notInclude(ids, de.id)
    assert.equal(response.inertiaProps.filters.country, 'FR')
  })

  test('repère les fournisseurs sans adresse de réception (#217)', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const fallback = await OrganizationFactory.apply('supplier').merge({ email: null }).create()
    const withQuote = await OrganizationFactory.apply('supplier').merge({ email: null }).create()
    await SupplierProfile.create({
      organizationId: withQuote.id,
      quoteEmail: 'devis@f.test',
      quoteEmailVerifiedAt: DateTime.now(),
    })
    // Adresse saisie mais pas confirmée : pas utilisée, le fournisseur se rabat sur ses membres.
    const pending = await OrganizationFactory.apply('supplier').merge({ email: null }).create()
    await SupplierProfile.create({ organizationId: pending.id, quoteEmail: 'devis@p.test' })
    const withContact = await OrganizationFactory.apply('supplier')
      .merge({ email: 'contact@f.test' })
      .create()
    const buyer = await OrganizationFactory.merge({ email: null }).create()

    const all = await client.get('/fr/admin/organizations?status=all').withInertia().loginAs(admin)
    const missing = await client
      .get('/fr/admin/organizations?status=all&missingQuoteAddress=true')
      .withInertia()
      .loginAs(admin)

    const sourceOf = (id: number) =>
      all.inertiaProps.organizationList.data.find((o: { id: number }) => o.id === id)
        ?.quoteAddressSource
    assert.equal(sourceOf(fallback.id), 'members')
    assert.equal(sourceOf(pending.id), 'members')
    assert.equal(sourceOf(withQuote.id), 'quote_email')
    assert.equal(sourceOf(withContact.id), 'organization_email')
    assert.isNull(sourceOf(buyer.id))
    // Le filtre SQL et la règle de la liste désignent exactement les mêmes organisations.
    const filtered = missing.inertiaProps.organizationList.data.map((o: { id: number }) => o.id)
    const flagged = all.inertiaProps.organizationList.data
      .filter((o: { quoteAddressSource: string | null }) => o.quoteAddressSource === 'members')
      .map((o: { id: number }) => o.id)
    assert.sameMembers(filtered, flagged)
    assert.sameMembers(filtered, [fallback.id, pending.id])
    assert.isTrue(missing.inertiaProps.filters.missingQuoteAddress)
  })

  test('une page invalide est refusee', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    for (const page of ['1.5', '0', '999999999']) {
      const response = await client
        .get(`/fr/admin/organizations?page=${page}`)
        .header('Accept', 'application/json')
        .loginAs(admin)
      response.assertStatus(422)
    }
  })

  test('filterOptions contient les types et pays', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await OrganizationFactory.merge({ country: 'FR' }).create()
    await OrganizationFactory.merge({ country: 'DE' }).create()

    const response = await client.get('/fr/admin/organizations').withInertia().loginAs(admin)

    assert.includeMembers(response.inertiaProps.filterOptions.organizationTypes, [
      'buyer',
      'supplier',
      'both',
    ])
    assert.includeMembers(response.inertiaProps.filterOptions.countries, ['FR', 'DE'])
  })
})

/**
 * Fiche enrichie (#161)
 */
test.group('Gestion organisations - fiche enrichie (#161)', (group) => {
  useDatabase(group)

  test('la fiche affiche les invitations en attente', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await createOrganizationWithOwner()
    const inviter = await createMember(organization, 'admin')
    await OrganizationInvitationFactory.merge({
      organizationId: organization.id,
      email: 'invited@example.com',
      invitedByUserId: inviter.id,
    }).create()

    const response = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(admin)

    const detail: AdminOrganizationDetail = response.inertiaProps.organization
    assert.lengthOf(detail.pendingInvitations, 1)
    assert.equal(detail.pendingInvitations[0].email, 'invited@example.com')
    assert.equal(detail.pendingInvitations[0].invitedByEmail, inviter.email)
  })

  test('la fiche expose canManage selon le droit', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const support = await UserFactory.apply('platformSupport').create()
    const { organization } = await createOrganizationWithOwner()

    const asAdmin = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(admin)
    const asSupport = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(support)

    assert.isTrue(asAdmin.inertiaProps.organization.canManage)
    assert.isFalse(asSupport.inertiaProps.organization.canManage)
  })

  test('la fiche expose le membershipId de chaque membre', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization, owner } = await createOrganizationWithOwner()

    const response = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(admin)

    const detail: AdminOrganizationDetail = response.inertiaProps.organization
    assert.isNumber(detail.members[0].membershipId)
    assert.equal(detail.members[0].id, owner.id)
  })
})

/**
 * Actions admin (#161)
 */
function orgAction(
  client: unknown,
  actor: unknown,
  orgId: number,
  action: string,
  method = 'post',
  body?: Record<string, unknown>
) {
  const path = `/fr/admin/organizations/${orgId}${action ? '/' + action : ''}`

  const c = client as any
  let req = method === 'post' ? c.post(path) : method === 'patch' ? c.patch(path) : c.delete(path)
  req = req.redirects(0).withCsrfToken().header('Accept', 'application/json').loginAs(actor)
  if (body) req = req.json(body)
  return req
}

test.group('Gestion organisations - archivage et restauration (#161)', (group) => {
  useDatabase(group)

  test('archiver une organisation pose archivedAt et trace laction', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await createOrganizationWithOwner()

    const response = await orgAction(client, admin, organization.id, 'archive')

    response.assertStatus(302)
    await organization.refresh()
    assert.isNotNull(organization.archivedAt)

    const [log] = await AdminAuditLog.query().where('action', 'organization.archived')
    assert.equal(log.targetId, organization.id)
    assert.equal(log.actorUserId, admin.id)
  })

  test('archiver revoque les invitations en attente', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await createOrganizationWithOwner()
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: organization.id,
    }).create()

    await orgAction(client, admin, organization.id, 'archive')

    await invitation.refresh()
    assert.equal(invitation.status, 'revoked')
  })

  test('archiver une organisation deja archivee renvoie 409', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.apply('archived').create()

    const response = await orgAction(client, admin, org.id, 'archive')

    response.assertStatus(302)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('restaurer une organisation retire archivedAt et trace laction', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.apply('archived').create()

    const response = await orgAction(client, admin, org.id, 'restore')

    response.assertStatus(302)
    await org.refresh()
    assert.isNull(org.archivedAt)

    const [log] = await AdminAuditLog.query().where('action', 'organization.restored')
    assert.equal(log.targetId, org.id)
  })

  test('restaurer une organisation active renvoie 409', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.create()

    const response = await orgAction(client, admin, org.id, 'restore')

    response.assertStatus(302)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })
})

test.group('Gestion organisations - modification (#161)', (group) => {
  useDatabase(group)

  test('modifier une organisation trace les champs changes', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.merge({
      name: 'Old Name',
      email: 'old@example.com',
    }).create()

    const response = await orgAction(client, admin, org.id, '', 'patch', {
      name: 'New Name',
      email: 'new@example.com',
    })

    response.assertStatus(302)
    await org.refresh()
    assert.equal(org.name, 'New Name')
    assert.equal(org.email, 'new@example.com')

    const [log] = await AdminAuditLog.query().where('action', 'organization.updated')
    assert.equal(log.changes?.before?.name, 'Old Name')
    assert.equal(log.changes?.after?.name, 'New Name')
  })

  test('modifier sans changement ne trace rien', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.merge({ name: 'Unchanged' }).create()

    await orgAction(client, admin, org.id, '', 'patch', { name: 'Unchanged' })

    assert.lengthOf(await AdminAuditLog.all(), 0)
  })
})

test.group('Gestion organisations - changement de type (#161)', (group) => {
  useDatabase(group)

  test('changer le type est trace', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.create() // buyer par defaut

    const response = await orgAction(client, admin, org.id, 'type', 'patch', {
      organizationType: 'supplier',
    })

    response.assertStatus(302)
    await org.refresh()
    assert.equal(org.organizationType, 'supplier')

    const [log] = await AdminAuditLog.query().where('action', 'organization.type_changed')
    assert.equal(log.changes?.before?.organizationType, 'buyer')
    assert.equal(log.changes?.after?.organizationType, 'supplier')
  })

  test('retirer la capacite fournisseur avec un profil fournisseur est refuse', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const org = await OrganizationFactory.apply('supplier').create()
    await SupplierProfile.create({ organizationId: org.id })

    const response = await orgAction(client, admin, org.id, 'type', 'patch', {
      organizationType: 'buyer',
    })

    response.assertStatus(302)
    await org.refresh()
    assert.equal(org.organizationType, 'supplier')
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })
})

test.group('Gestion organisations - membres (#161)', (group) => {
  useDatabase(group)

  test('changer le role d un membre est trace', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await createOrganizationWithOwner()
    const member = await createMember(organization, 'member')
    const membershipResp = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(admin)
    const membership = membershipResp.inertiaProps.organization.members.find(
      (m: { id: number }) => m.id === member.id
    )

    const adminRole = await Role.findByOrFail('slug', 'admin')

    const response = await client
      .patch(`/fr/admin/organizations/${organization.id}/members/${membership.membershipId}/role`)
      .redirects(0)
      .withCsrfToken()
      .json({ roleId: adminRole.id })
      .loginAs(admin)

    response.assertStatus(302)
    const [log] = await AdminAuditLog.query().where('action', 'organization.member_role_changed')
    assert.equal(log.targetId, organization.id)
    assert.equal(log.changes?.before?.roleSlug, 'member')
  })

  test('retirer le dernier owner est refuse', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization, owner } = await createOrganizationWithOwner()
    const membershipResp = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(admin)
    const membership = membershipResp.inertiaProps.organization.members.find(
      (m: { id: number }) => m.id === owner.id
    )

    const response = await client
      .delete(`/fr/admin/organizations/${organization.id}/members/${membership.membershipId}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(302)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('retirer un membre non-owner est trace', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await createOrganizationWithOwner()
    const member = await createMember(organization, 'member')
    const membershipResp = await client
      .get(`/fr/admin/organizations/${organization.id}`)
      .withInertia()
      .loginAs(admin)
    const membership = membershipResp.inertiaProps.organization.members.find(
      (m: { id: number }) => m.id === member.id
    )

    const response = await client
      .delete(`/fr/admin/organizations/${organization.id}/members/${membership.membershipId}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(302)
    const [log] = await AdminAuditLog.query().where('action', 'organization.member_removed')
    assert.equal(log.targetId, organization.id)
  })
})

test.group('Gestion organisations - invitations (#161)', (group) => {
  useDatabase(group)

  test('revoquer une invitation est trace', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await createOrganizationWithOwner()
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: organization.id,
    }).create()

    const response = await client
      .delete(`/fr/admin/organizations/${organization.id}/invitations/${invitation.id}`)
      .redirects(0)
      .withCsrfToken()
      .loginAs(admin)

    response.assertStatus(302)
    await invitation.refresh()
    assert.equal(invitation.status, 'revoked')

    const [log] = await AdminAuditLog.query().where('action', 'organization.invitation_revoked')
    assert.equal(log.targetId, organization.id)
  })

  test('renvoyer une invitation envoie un mail et trace laction', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await createOrganizationWithOwner()
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: organization.id,
    }).create()
    const originalExpires = invitation.expiresAt

    mail.fake()
    try {
      const response = await client
        .post(`/fr/admin/organizations/${organization.id}/invitations/${invitation.id}/resend`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(admin)

      response.assertStatus(302)
      await invitation.refresh()
      assert.isTrue(invitation.expiresAt > originalExpires)

      const [log] = await AdminAuditLog.query().where('action', 'organization.invitation_resent')
      assert.equal(log.targetId, organization.id)
    } finally {
      mail.restore()
    }
  })

  test('renvoyer une invitation non pending renvoie 409', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const { organization } = await createOrganizationWithOwner()
    const invitation = await OrganizationInvitationFactory.merge({
      organizationId: organization.id,
      status: 'revoked',
    }).create()

    mail.fake()
    try {
      const response = await client
        .post(`/fr/admin/organizations/${organization.id}/invitations/${invitation.id}/resend`)
        .redirects(0)
        .withCsrfToken()
        .loginAs(admin)

      response.assertStatus(302)
      assert.lengthOf(await AdminAuditLog.all(), 0)
    } finally {
      mail.restore()
    }
  })
})

test.group('Gestion organisations - droits (#161)', (group) => {
  useDatabase(group)

  test('seul admin archive, restaure, modifie', async ({ client }) => {
    const { organization } = await createOrganizationWithOwner()

    for (const role of ['platformSupport', 'platformModerator', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(role).create()

      const archive = await orgAction(client, user, organization.id, 'archive')
      archive.assertStatus(403)

      const restore = await orgAction(client, user, organization.id, 'restore')
      restore.assertStatus(403)

      const update = await orgAction(client, user, organization.id, '', 'patch', { name: 'X' })
      update.assertStatus(403)
    }
  })

  test('un utilisateur ordinaire ne peut pas agir', async ({ client }) => {
    const { organization, owner } = await createOrganizationWithOwner()

    const archive = await orgAction(client, owner, organization.id, 'archive')
    archive.assertStatus(403)
  })
})
