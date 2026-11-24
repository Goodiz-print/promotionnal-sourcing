import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { ProductFactory } from '#database/factories/product_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import type Supplier from '#models/supplier'
import SearchSyncService from '#services/search_sync_service'
import TranslationQueueService from '#services/translation_queue_service'
import { createMember } from '#tests/utils/organizations'
import { useDatabase } from '#tests/utils/setup'
import type { AdminSupplierLinkItem } from '#shared/types/supplier_link'

const linkUrl = (supplier: Supplier) => `/fr/admin/supplier-links/${supplier.id}/link`

interface LinkRequest {
  supplier: Supplier
  organizationId: number
}

function link(client: any, user: unknown, { supplier, organizationId }: LinkRequest) {
  return client
    .post(linkUrl(supplier))
    .redirects(0)
    .withCsrfToken()
    .loginAs(user)
    .form({ organizationId })
}

function unlink(client: any, user: unknown, supplier: Supplier) {
  return client.delete(linkUrl(supplier)).redirects(0).withCsrfToken().loginAs(user)
}

/** Espion de `SearchSyncService` : fiches dont les produits ont été mis en réindexation. */
function spySearchSync(): number[] {
  const queued: number[] = []
  app.container.swap(
    SearchSyncService,
    () =>
      ({
        queueSupplier: async (id: number) => {
          queued.push(id)
        },
      }) as unknown as SearchSyncService
  )
  return queued
}

/** Espion de `TranslationQueueService` : fiches dont les produits ont été mis en traduction. */
function spyTranslations(): number[] {
  const queued: number[] = []
  app.container.swap(
    TranslationQueueService,
    () =>
      ({
        queueSupplier: async (id: number) => {
          queued.push(id)
          return true
        },
      }) as unknown as TranslationQueueService
  )
  return queued
}

async function listed(client: any, user: unknown, qs = '') {
  const response = await client.get(`/fr/admin/supplier-links${qs}`).withInertia().loginAs(user)
  response.assertStatus(200)
  response.assertInertiaComponent('admin/supplier_links/index')
  return response.inertiaProps as {
    suppliers: { data: AdminSupplierLinkItem[]; meta: { total: number } }
    organizationOptions: { id: number; name: string }[]
  }
}

test.group('Back-office — rattachement des fiches fournisseur (#231)', (group) => {
  useDatabase(group)
  group.each.teardown(() => {
    app.container.restore(SearchSyncService)
    app.container.restore(TranslationQueueService)
  })

  test('liste les fiches en attente avec l’organisation proposée', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.apply('supplier').create()
    await createMember(organization, 'owner', { email: 'ana@makito-test.es' })
    const pending = await SupplierFactory.merge({ email: 'info@makito-test.es' }).create()
    await ProductFactory.merge({ supplierId: pending.id }).with('category').createMany(2)
    const linked = await SupplierFactory.merge({ organizationId: organization.id }).create()

    const { suppliers, organizationOptions } = await listed(client, admin)

    const item = suppliers.data.find((row) => row.id === pending.id)
    assert.isUndefined(suppliers.data.find((row) => row.id === linked.id))
    assert.equal(item?.productsCount, 2)
    assert.deepEqual(item?.suggestion, {
      organizationId: organization.id,
      organizationName: organization.name,
      match: 'domain',
    })
    assert.include(
      organizationOptions.map((option) => option.id),
      organization.id
    )
  })

  test('rattache une fiche : accord daté et signé, tracé, produits réindexés et traduits', async ({
    client,
    assert,
  }) => {
    const queued = spySearchSync()
    const translated = spyTranslations()
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.apply('supplier').create()
    const supplier = await SupplierFactory.create()

    const response = await link(client, admin, { supplier, organizationId: organization.id })

    response.assertStatus(302)
    await supplier.refresh()
    assert.equal(supplier.organizationId, organization.id)
    assert.equal(supplier.linkedByUserId, admin.id)
    assert.isNotNull(supplier.linkedAt)
    assert.deepEqual(queued, [supplier.id])
    assert.deepEqual(translated, [supplier.id])

    const log = await AdminAuditLog.query()
      .where('action', 'supplier.linked')
      .where('targetId', supplier.id)
      .firstOrFail()
    assert.equal(log.targetType, 'supplier')
    assert.equal(log.actorUserId, admin.id)
    assert.deepEqual(log.changes?.after, { organizationId: organization.id })

    const { suppliers } = await listed(client, admin, '?status=linked')
    const item = suppliers.data.find((row) => row.id === supplier.id)
    assert.equal(item?.organization?.id, organization.id)
    assert.equal(item?.linkedByEmail, admin.email)
  })

  test('une fiche déjà rattachée ne peut pas l’être à une autre organisation', async ({
    client,
    assert,
  }) => {
    const queued = spySearchSync()
    const translated = spyTranslations()
    const admin = await UserFactory.apply('platformAdmin').create()
    const first = await OrganizationFactory.apply('supplier').create()
    const second = await OrganizationFactory.apply('supplier').create()
    const supplier = await SupplierFactory.merge({ organizationId: first.id }).create()

    const response = await link(client, admin, { supplier, organizationId: second.id })

    response.assertStatus(302)
    assert.equal(
      response.flashMessages().error,
      "Cette fiche est déjà rattachée à une organisation. Détachez-la d'abord."
    )
    await supplier.refresh()
    assert.equal(supplier.organizationId, first.id)
    assert.isEmpty(queued)
    assert.isEmpty(translated)
    assert.isNull(await AdminAuditLog.findBy('action', 'supplier.linked'))
  })

  test('refuse une organisation acheteuse ou archivée', async ({ client, assert }) => {
    spySearchSync()
    const admin = await UserFactory.apply('platformAdmin').create()
    const buyer = await OrganizationFactory.create()
    const archived = await OrganizationFactory.apply('supplier').apply('archived').create()
    const supplier = await SupplierFactory.create()

    const responses = await Promise.all(
      [buyer, archived].map((organization) =>
        link(client, admin, { supplier, organizationId: organization.id })
      )
    )

    assert.deepEqual(
      responses.map((response) => response.flashMessages().error),
      Array(2).fill('Choisissez une organisation fournisseur active.')
    )
    await supplier.refresh()
    assert.isNull(supplier.organizationId)
  })

  test('détache une fiche : accord effacé, tracé, produits réindexés, rien à traduire', async ({
    client,
    assert,
  }) => {
    const queued = spySearchSync()
    const translated = spyTranslations()
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.apply('supplier').create()
    const supplier = await SupplierFactory.merge({ organizationId: organization.id }).create()

    const response = await unlink(client, admin, supplier)

    response.assertStatus(302)
    await supplier.refresh()
    assert.isNull(supplier.organizationId)
    assert.isNull(supplier.linkedAt)
    assert.isNull(supplier.linkedByUserId)
    assert.deepEqual(queued, [supplier.id])
    assert.isEmpty(translated)

    const log = await AdminAuditLog.query()
      .where('action', 'supplier.unlinked')
      .where('targetId', supplier.id)
      .firstOrFail()
    assert.deepEqual(log.changes?.before, { organizationId: organization.id })

    const again = await unlink(client, admin, supplier)
    assert.equal(again.flashMessages().error, "Cette fiche n'est rattachée à aucune organisation.")
  })

  test('réservé aux admins : modérateur et support refusés', async ({ client, assert }) => {
    spySearchSync()
    const organization = await OrganizationFactory.apply('supplier').create()
    const supplier = await SupplierFactory.create()

    const moderator = await UserFactory.apply('platformModerator').create()
    const support = await UserFactory.apply('platformSupport').create()
    const responses = await Promise.all([
      client.get('/fr/admin/supplier-links').loginAs(moderator),
      client.get('/fr/admin/supplier-links').loginAs(support),
      // En JSON, le refus garde son statut au lieu d'une redirection.
      link(client, moderator, { supplier, organizationId: organization.id }).header(
        'Accept',
        'application/json'
      ),
      unlink(client, support, supplier).header('Accept', 'application/json'),
    ])

    assert.deepEqual(
      responses.map((response) => response.status()),
      [403, 403, 403, 403]
    )
    await supplier.refresh()
    assert.isNull(supplier.organizationId)
  })
})
