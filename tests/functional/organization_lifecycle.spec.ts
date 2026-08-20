import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import RoleSeeder from '#database/seeders/role_seeder'
import PermissionSeeder from '#database/seeders/permission_seeder'
import RolePermissionSeeder from '#database/seeders/role_permission_seeder'
import User from '#models/user'
import Role from '#models/role'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import OrganizationInvitation from '#models/organization_invitation'
import Supplier from '#models/supplier'
import OrganizationService from '#services/organization_service'
import OrganizationContextService from '#services/organization_context_service'
import SupplierDirectoryService from '#services/supplier_directory_service'
import {
  LastOwnerException,
  NotAMemberException,
  OrganizationArchivedException,
} from '#exceptions/organization_errors'

async function makeUser(email: string): Promise<User> {
  return User.create({
    email,
    password: await hash.make('password123'),
    fullName: `Test ${email}`,
  })
}

async function join(
  user: User,
  organization: Organization,
  roleSlug: string,
  { asCurrent = true }: { asCurrent?: boolean } = {}
): Promise<OrganizationUser> {
  const role = await Role.findByOrFail('slug', roleSlug)
  const membership = await OrganizationUser.create({
    userId: user.id,
    organizationId: organization.id,
    roleId: role.id,
    joinedAt: DateTime.now(),
  })
  if (asCurrent) await user.merge({ currentOrganizationId: organization.id }).save()
  return membership
}

function makeOrganization(name: string, slug: string): Promise<Organization> {
  return Organization.create({ name, slug, country: 'FR' })
}

test.group("Cycle de vie de l'organisation", (group) => {
  group.each.setup(() => testUtils.db().truncate())
  group.each.setup(async () => {
    await new RoleSeeder(db.connection()).run()
    await new PermissionSeeder(db.connection()).run()
    await new RolePermissionSeeder(db.connection()).run()
  })

  test('créer une organisation supplémentaire bascule dessus', async ({ assert }) => {
    const first = await makeOrganization('Acme', 'acme')
    const user = await makeUser('owner@example.com')
    await join(user, first, 'owner')

    const service = await app.container.make(OrganizationService)
    const second = await service.create(user, { name: 'Beta', organizationType: 'supplier' })

    await user.refresh()
    assert.equal(user.currentOrganizationId, second.id)

    const membership = await OrganizationUser.query()
      .where('userId', user.id)
      .where('organizationId', second.id)
      .preload('role')
      .firstOrFail()
    assert.equal(membership.role.slug, 'owner')
    assert.equal(second.organizationType, 'supplier')
  })

  test('quitter une organisation bascule sur une autre adhésion', async ({ assert }) => {
    const first = await makeOrganization('Acme', 'acme')
    const second = await makeOrganization('Beta', 'beta')
    const user = await makeUser('member@example.com')
    await join(user, first, 'member', { asCurrent: false })
    await join(user, second, 'member')

    const service = await app.container.make(OrganizationService)
    await service.leave(user, second)

    await user.refresh()
    assert.equal(user.currentOrganizationId, first.id)
    assert.isNull(
      await OrganizationUser.query()
        .where('userId', user.id)
        .where('organizationId', second.id)
        .first()
    )
  })

  test('quitter sa seule organisation laisse sans organisation courante', async ({ assert }) => {
    const org = await makeOrganization('Acme', 'acme')
    const owner = await makeUser('owner@example.com')
    const member = await makeUser('member@example.com')
    await join(owner, org, 'owner')
    await join(member, org, 'member')

    const service = await app.container.make(OrganizationService)
    await service.leave(member, org)

    await member.refresh()
    assert.isNull(member.currentOrganizationId)
  })

  test('le dernier owner ne peut pas quitter son organisation', async ({ assert }) => {
    const org = await makeOrganization('Acme', 'acme')
    const owner = await makeUser('owner@example.com')
    await join(owner, org, 'owner')

    const service = await app.container.make(OrganizationService)
    await assert.rejects(() => service.leave(owner, org), LastOwnerException.message)

    await owner.refresh()
    assert.equal(owner.currentOrganizationId, org.id)
  })

  test("quitter une organisation dont on n'est pas membre est refusé", async ({ assert }) => {
    const org = await makeOrganization('Acme', 'acme')
    const other = await makeOrganization('Beta', 'beta')
    const user = await makeUser('member@example.com')
    await join(user, org, 'member')

    const service = await app.container.make(OrganizationService)
    await assert.rejects(() => service.leave(user, other), NotAMemberException.message)
  })

  test('archiver une organisation révoque ses invitations en attente', async ({ assert }) => {
    const org = await makeOrganization('Acme', 'acme')
    const owner = await makeUser('owner@example.com')
    await join(owner, org, 'owner')
    const memberRole = await Role.findByOrFail('slug', 'member')

    const pending = await OrganizationInvitation.create({
      organizationId: org.id,
      email: 'invited@example.com',
      roleId: memberRole.id,
      invitedByUserId: owner.id,
      status: 'pending',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })
    const accepted = await OrganizationInvitation.create({
      organizationId: org.id,
      email: 'already@example.com',
      roleId: memberRole.id,
      invitedByUserId: owner.id,
      status: 'accepted',
      expiresAt: DateTime.now().plus({ days: 7 }),
    })

    const service = await app.container.make(OrganizationService)
    await service.archive(org)

    await org.refresh()
    await pending.refresh()
    await accepted.refresh()
    assert.isNotNull(org.archivedAt)
    assert.equal(pending.status, 'revoked')
    assert.equal(accepted.status, 'accepted')
  })

  test('archiver une organisation déjà archivée est refusé', async ({ assert }) => {
    const org = await makeOrganization('Acme', 'acme')
    const service = await app.container.make(OrganizationService)
    await service.archive(org)

    await assert.rejects(() => service.archive(org), OrganizationArchivedException.message)
  })

  test('on ne bascule ni sur une organisation étrangère ni sur une archivée', async ({
    assert,
  }) => {
    const mine = await makeOrganization('Acme', 'acme')
    const foreign = await makeOrganization('Beta', 'beta')
    const archived = await makeOrganization('Gamma', 'gamma')
    const user = await makeUser('member@example.com')
    await join(user, mine, 'member')
    await join(user, archived, 'member', { asCurrent: false })

    const organizations = await app.container.make(OrganizationService)
    await organizations.archive(archived)

    const context = await app.container.make(OrganizationContextService)
    await assert.rejects(() => context.switchTo(user, foreign.id), NotAMemberException.message)
    await assert.rejects(
      () => context.switchTo(user, archived.id),
      OrganizationArchivedException.message
    )

    await user.refresh()
    assert.equal(user.currentOrganizationId, mine.id)
  })

  test("le membre d'une organisation archivée bascule sur une autre adhésion", async ({
    client,
    assert,
  }) => {
    const archived = await makeOrganization('Acme', 'acme')
    const other = await makeOrganization('Beta', 'beta')
    const user = await makeUser('owner@example.com')
    await join(user, other, 'owner', { asCurrent: false })
    await join(user, archived, 'owner')

    const service = await app.container.make(OrganizationService)
    await service.archive(archived)

    const response = await client.get('/fr/organization/members').withInertia().loginAs(user)

    response.assertStatus(200)
    await user.refresh()
    assert.equal(user.currentOrganizationId, other.id)
  })

  test("le membre d'une organisation archivée sans autre adhésion repart sur l'onboarding", async ({
    client,
    assert,
  }) => {
    const archived = await makeOrganization('Acme', 'acme')
    const user = await makeUser('owner@example.com')
    await join(user, archived, 'owner')

    const service = await app.container.make(OrganizationService)
    await service.archive(archived)

    const response = await client
      .get('/fr/organization/members')
      .redirects(0)
      .withInertia()
      .loginAs(user)

    response.assertStatus(302)
    response.assertHeader('location', '/fr/onboarding')
    await user.refresh()
    assert.isNull(user.currentOrganizationId)
  })

  test("les fiches d'une organisation archivée sortent de l'annuaire public", async ({
    assert,
  }) => {
    const archived = await makeOrganization('Acme', 'acme')
    const live = await makeOrganization('Beta', 'beta')

    await Supplier.create({ slug: 'acme-supplier', country: 'FR', organizationId: archived.id })
    await Supplier.create({ slug: 'beta-supplier', country: 'FR', organizationId: live.id })
    // Fiche importée non encore rattachée : doit rester visible.
    await Supplier.create({ slug: 'orphan-supplier', country: 'FR' })

    const service = await app.container.make(OrganizationService)
    await service.archive(archived)

    const directory = await app.container.make(SupplierDirectoryService)
    const page = await directory.list({
      page: 1,
      perPage: 20,
      search: null,
      country: null,
    })
    const slugs = page.all().map((supplier) => supplier.slug)

    assert.notInclude(slugs, 'acme-supplier')
    assert.includeMembers(slugs, ['beta-supplier', 'orphan-supplier'])
    assert.isNull(await directory.findBySlug('acme-supplier'))
  })

  test("le sélecteur d'organisation est exposé aux pages Inertia", async ({ client, assert }) => {
    const first = await makeOrganization('Acme', 'acme')
    const second = await makeOrganization('Beta', 'beta')
    const user = await makeUser('owner@example.com')
    await join(user, first, 'owner', { asCurrent: false })
    await join(user, second, 'owner')

    const response = await client.get('/fr/organization/members').withInertia().loginAs(user)

    response.assertStatus(200)
    assert.deepEqual(
      response.inertiaProps.organizations.map(
        (organization: { name: string }) => organization.name
      ),
      ['Acme', 'Beta']
    )
    assert.equal(response.inertiaProps.currentOrganizationId, second.id)
  })

  test('une organisation archivée sort du sélecteur', async ({ client, assert }) => {
    const kept = await makeOrganization('Acme', 'acme')
    const archived = await makeOrganization('Beta', 'beta')
    const user = await makeUser('owner@example.com')
    await join(user, kept, 'owner')
    await join(user, archived, 'owner', { asCurrent: false })

    const service = await app.container.make(OrganizationService)
    await service.archive(archived)

    const response = await client.get('/fr/organization/members').withInertia().loginAs(user)

    assert.lengthOf(response.inertiaProps.organizations, 1)
    assert.equal(response.inertiaProps.organizations[0].name, 'Acme')
  })

  test("basculer d'organisation via le sélecteur", async ({ client, assert }) => {
    const first = await makeOrganization('Acme', 'acme')
    const second = await makeOrganization('Beta', 'beta')
    const user = await makeUser('owner@example.com')
    await join(user, first, 'owner', { asCurrent: false })
    await join(user, second, 'owner')

    const response = await client
      .post(`/fr/organization/switch/${first.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)

    response.assertStatus(200)
    await user.refresh()
    assert.equal(user.currentOrganizationId, first.id)
  })

  test('basculer sur une organisation étrangère ne change rien', async ({ client, assert }) => {
    const mine = await makeOrganization('Acme', 'acme')
    const foreign = await makeOrganization('Beta', 'beta')
    const user = await makeUser('owner@example.com')
    await join(user, mine, 'owner')

    const response = await client
      .post(`/fr/organization/switch/${foreign.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)

    response.assertStatus(200)
    await user.refresh()
    assert.equal(user.currentOrganizationId, mine.id)
  })

  test("l'écran de création d'une organisation supplémentaire est accessible", async ({
    client,
  }) => {
    const org = await makeOrganization('Acme', 'acme')
    const user = await makeUser('owner@example.com')
    await join(user, org, 'owner')

    const response = await client.get('/fr/organization/new').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('organization/create')
  })

  test('créer une organisation depuis les paramètres bascule dessus', async ({
    client,
    assert,
  }) => {
    const org = await makeOrganization('Acme', 'acme')
    const user = await makeUser('owner@example.com')
    await join(user, org, 'owner')

    const response = await client
      .post('/fr/organization/new')
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      .json({ name: 'Beta', organizationType: 'buyer' })

    response.assertStatus(200)
    await user.refresh()
    const created = await Organization.findByOrFail('slug', 'beta')
    assert.equal(user.currentOrganizationId, created.id)
  })
})
