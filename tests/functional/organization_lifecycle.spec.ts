import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
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
import { joinOrganization } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'

test.group("Cycle de vie de l'organisation", (group) => {
  useDatabase(group)

  test('créer une organisation supplémentaire bascule dessus', async ({ assert }) => {
    const first = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, first, 'owner')

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
    const first = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const second = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, first, 'member', { asCurrent: false })
    await joinOrganization(user, second, 'member')

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
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await UserFactory.create()
    const member = await UserFactory.create()
    await joinOrganization(owner, org, 'owner')
    await joinOrganization(member, org, 'member')

    const service = await app.container.make(OrganizationService)
    await service.leave(member, org)

    await member.refresh()
    assert.isNull(member.currentOrganizationId)
  })

  test('le dernier owner ne peut pas quitter son organisation', async ({ assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await UserFactory.create()
    await joinOrganization(owner, org, 'owner')

    const service = await app.container.make(OrganizationService)
    await assert.rejects(() => service.leave(owner, org), LastOwnerException.message)

    await owner.refresh()
    assert.equal(owner.currentOrganizationId, org.id)
  })

  test("quitter une organisation dont on n'est pas membre est refusé", async ({ assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const other = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, org, 'member')

    const service = await app.container.make(OrganizationService)
    await assert.rejects(() => service.leave(user, other), NotAMemberException.message)
  })

  test('archiver une organisation révoque ses invitations en attente', async ({ assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await UserFactory.create()
    await joinOrganization(owner, org, 'owner')
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
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const service = await app.container.make(OrganizationService)
    await service.archive(org)

    await assert.rejects(() => service.archive(org), OrganizationArchivedException.message)
  })

  test('on ne bascule ni sur une organisation étrangère ni sur une archivée', async ({
    assert,
  }) => {
    const mine = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const foreign = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()
    const archived = await OrganizationFactory.merge({ name: 'Gamma', slug: 'gamma' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, mine, 'member')
    await joinOrganization(user, archived, 'member', { asCurrent: false })

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
    const archived = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const other = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, other, 'owner', { asCurrent: false })
    await joinOrganization(user, archived, 'owner')

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
    const archived = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, archived, 'owner')

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
    const archived = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const live = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()

    await Supplier.create({ slug: 'acme-supplier', country: 'FR', organizationId: archived.id })
    await Supplier.create({ slug: 'beta-supplier', country: 'FR', organizationId: live.id })
    // Fiche importée non encore rattachée : pas publiée (#240).
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
    assert.notInclude(slugs, 'orphan-supplier')
    assert.include(slugs, 'beta-supplier')
    assert.isNull(await directory.findBySlug('acme-supplier'))
    assert.isNull(await directory.findBySlug('orphan-supplier'))
  })

  test("le sélecteur d'organisation est exposé aux pages Inertia", async ({ client, assert }) => {
    const first = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const second = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, first, 'owner', { asCurrent: false })
    await joinOrganization(user, second, 'owner')

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
    const kept = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const archived = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, kept, 'owner')
    await joinOrganization(user, archived, 'owner', { asCurrent: false })

    const service = await app.container.make(OrganizationService)
    await service.archive(archived)

    const response = await client.get('/fr/organization/members').withInertia().loginAs(user)

    assert.lengthOf(response.inertiaProps.organizations, 1)
    assert.equal(response.inertiaProps.organizations[0].name, 'Acme')
  })

  test("basculer d'organisation via le sélecteur", async ({ client, assert }) => {
    const first = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const second = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, first, 'owner', { asCurrent: false })
    await joinOrganization(user, second, 'owner')

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
    const mine = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const foreign = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, mine, 'owner')

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
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, org, 'owner')

    const response = await client.get('/fr/organization/new').withInertia().loginAs(user)

    response.assertStatus(200)
    response.assertInertiaComponent('organization/create')
  })

  test('créer une organisation depuis les paramètres bascule dessus', async ({
    client,
    assert,
  }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const user = await UserFactory.create()
    await joinOrganization(user, org, 'owner')

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

  test("quitter l'organisation courante depuis l'écran des paramètres", async ({
    client,
    assert,
  }) => {
    const first = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const second = await OrganizationFactory.merge({ name: 'Beta', slug: 'beta' }).create()
    const owner = await UserFactory.create()
    const member = await UserFactory.create()
    await joinOrganization(owner, second, 'owner')
    await joinOrganization(member, first, 'member', { asCurrent: false })
    await joinOrganization(member, second, 'member')

    const response = await client
      .delete('/fr/organization/leave')
      .withInertia()
      .withCsrfToken()
      .loginAs(member)

    response.assertStatus(200)
    await member.refresh()
    assert.equal(member.currentOrganizationId, first.id)
  })

  test('le dernier owner ne peut pas quitter depuis la route', async ({ client, assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await UserFactory.create()
    await joinOrganization(owner, org, 'owner')

    const response = await client
      .delete('/fr/organization/leave')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(200)
    assert.isNotNull(
      await OrganizationUser.query()
        .where('userId', owner.id)
        .where('organizationId', org.id)
        .first()
    )
  })

  test("l'écran des paramètres masque le départ pour le dernier owner", async ({
    client,
    assert,
  }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await UserFactory.create()
    const admin = await UserFactory.create()
    await joinOrganization(owner, org, 'owner')
    await joinOrganization(admin, org, 'admin')

    const ownerResponse = await client.get('/fr/organization/settings').withInertia().loginAs(owner)
    const adminResponse = await client.get('/fr/organization/settings').withInertia().loginAs(admin)

    assert.isFalse(ownerResponse.inertiaProps.canLeave)
    assert.isTrue(adminResponse.inertiaProps.canLeave)
  })

  test("archiver l'organisation courante (owner)", async ({ client, assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await UserFactory.create()
    await joinOrganization(owner, org, 'owner')

    const response = await client
      .post('/fr/organization/archive')
      .withInertia()
      .withCsrfToken()
      .loginAs(owner)

    response.assertStatus(200)
    await org.refresh()
    await owner.refresh()
    assert.isNotNull(org.archivedAt)
    // L'auteur de l'archivage ne reste pas rattaché à une organisation morte.
    assert.isNull(owner.currentOrganizationId)
  })

  test('un membre simple ne peut pas archiver', async ({ client, assert }) => {
    const org = await OrganizationFactory.merge({ name: 'Acme', slug: 'acme' }).create()
    const owner = await UserFactory.create()
    const member = await UserFactory.create()
    await joinOrganization(owner, org, 'owner')
    await joinOrganization(member, org, 'member')

    // Bouncer redirige (back + flash « error ») plutôt qu'un 403 brut sur les
    // requêtes POST/PATCH/DELETE — on vérifie l'effet réel.
    await client.post('/fr/organization/archive').withInertia().withCsrfToken().loginAs(member)

    await org.refresh()
    assert.isNull(org.archivedAt)
  })
})
