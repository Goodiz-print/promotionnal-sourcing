import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import OrganizationCatalogueChanged from '#events/organization_catalogue_changed'
import ProductChanged from '#events/product_changed'
import { ModerationDecisionFactory } from '#database/factories/moderation_decision_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import ModerationDecisionRecord from '#models/moderation_decision'
import Product from '#models/product'
import { useDatabase } from '#tests/utils/setup'

interface QueueItem {
  targetType: string
  targetId: number
  label: string
  status: string
}

async function queue(client: any, user: unknown, qs = '') {
  const response = await client.get(`/fr/admin/moderation${qs}`).withInertia().loginAs(user)
  response.assertStatus(200)
  return response.inertiaProps as {
    queue: { data: QueueItem[]; meta: { total: number } }
    filters: Record<string, unknown>
  }
}

/**
 * Décision par JSON : un refus (403), une erreur de validation (422) ou une
 * cible inconnue (404) gardent leur statut, et le succès reste une redirection.
 */
function decide(client: any, user: unknown, path: string, body: Record<string, unknown>) {
  return client
    .post(`/fr/admin/moderation/${path}/decision`)
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
    .json(body)
}

test.group('Modération — file et droits', (group) => {
  useDatabase(group, { seed: 'full' })

  test('un modérateur et un admin accèdent à la file, pas le support', async ({ client }) => {
    const moderator = await UserFactory.apply('platformModerator').create()
    const support = await UserFactory.apply('platformSupport').create()

    const ok = await client.get('/fr/admin/moderation').withInertia().loginAs(moderator)
    ok.assertStatus(200)
    ok.assertInertiaComponent('admin/moderation/index')

    const denied = await client.get('/fr/admin/moderation').withInertia().loginAs(support)
    denied.assertStatus(403)
    const decision = await decide(client, support, 'product/1', { status: 'approved' })
    decision.assertStatus(403)
  })

  test('la file contient les produits actifs et les fournisseurs sans décision', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const supplier = await OrganizationFactory.apply('supplier').create()
    await OrganizationFactory.create() // acheteur : jamais modérable
    await OrganizationFactory.apply('supplier').apply('archived').create()

    const { queue: result, filters } = await queue(client, admin)

    assert.equal(filters.status, 'pending')
    assert.isTrue(
      result.data.some((i) => i.targetType === 'organization' && i.targetId === supplier.id)
    )
    const organizations = result.data.filter((i) => i.targetType === 'organization')
    assert.isTrue(
      organizations.every((i) => i.label !== '' && i.status === 'pending'),
      'chaque fournisseur de la file est en attente et nommé'
    )
    const productCount = await Product.query().where('isActive', true).count('* as total')
    const products = result.data.filter((i) => i.targetType === 'product')
    assert.isAbove(products.length, 0)
    assert.isAtMost(products.length, Number(productCount[0].$extras.total))
    assert.isTrue(products.every((i) => i.label !== ''))
  })

  test('filtre par type, par statut et par ancienneté', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const old = await OrganizationFactory.apply('supplier').create()
    await db
      .from('organizations')
      .where('id', old.id)
      .update({
        created_at: DateTime.now().minus({ days: 40 }).toJSDate(),
      })
    const rejected = await OrganizationFactory.apply('supplier').create()
    await ModerationDecisionFactory.apply('organization')
      .apply('rejected')
      .merge({ targetId: rejected.id })
      .create()

    const orgsOnly = await queue(client, admin, '?type=organization')
    assert.isTrue(orgsOnly.queue.data.every((i) => i.targetType === 'organization'))

    const aged = await queue(client, admin, '?type=organization&minAgeDays=30')
    assert.deepEqual(
      aged.queue.data.map((i) => i.targetId),
      [old.id]
    )

    const rejectedList = await queue(client, admin, '?status=rejected')
    assert.deepEqual(
      rejectedList.queue.data.map((i) => [i.targetType, i.targetId, i.status]),
      [['organization', rejected.id, 'rejected']]
    )
  })

  test('un filtre invalide est une erreur de validation', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/moderation?type=rfq')
      .header('Accept', 'application/json')
      .loginAs(admin)

    response.assertStatus(422)
  })
})

test.group('Modération — décisions', (group) => {
  useDatabase(group, { seed: 'full' })
  // Un échec d'assertion ne doit pas laisser l'émetteur factice aux autres suites.
  group.each.teardown(() => emitter.restore())

  test('approuver écrit la décision, l’audit et réindexe le catalogue', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const fake = emitter.fake([OrganizationCatalogueChanged])

    const response = await decide(client, admin, `organization/${supplier.id}`, {
      status: 'approved',
    })

    assert.isAtLeast(response.status(), 302)
    assert.isBelow(response.status(), 400)
    const records = await ModerationDecisionRecord.query().where('targetId', supplier.id)
    assert.lengthOf(records, 1)
    assert.equal(records[0].status, 'approved')
    assert.equal(records[0].decidedByUserId, admin.id)
    const audit = await AdminAuditLog.query().where('action', 'moderation.approved').firstOrFail()
    assert.equal(audit.targetType, 'organization')
    assert.equal(audit.targetId, supplier.id)
    assert.equal(audit.actorEmail, admin.email)
    assert.deepEqual(audit.changes?.before, { status: 'pending' })
    fake.assertEmitted(
      OrganizationCatalogueChanged,
      ({ data }) => data.organizationId === supplier.id
    )
  })

  test('rejeter exige un motif, conservé dans l’historique et l’audit', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()
    const fake = emitter.fake([ProductChanged])

    const missing = await decide(client, admin, `product/${product.id}`, { status: 'rejected' })
    missing.assertStatus(422)
    assert.lengthOf(await ModerationDecisionRecord.all(), 0)
    fake.assertNotEmitted(ProductChanged)

    const done = await decide(client, admin, `product/${product.id}`, {
      status: 'rejected',
      reason: 'Photos manquantes',
    })
    assert.isBelow(done.status(), 400)

    const [record] = await ModerationDecisionRecord.query().where('targetId', product.id)
    assert.equal(record.status, 'rejected')
    assert.equal(record.reason, 'Photos manquantes')
    const audit = await AdminAuditLog.query().where('action', 'moderation.rejected').firstOrFail()
    assert.deepEqual(audit.changes?.after, { status: 'rejected', reason: 'Photos manquantes' })
    fake.assertEmitted(ProductChanged, ({ data }) => data.productId === product.id)

    const history = await client
      .get(`/fr/admin/moderation/product/${product.id}`)
      .withInertia()
      .loginAs(admin)
    history.assertInertiaComponent('admin/moderation/show')
    assert.equal(history.inertiaProps.detail.item.status, 'rejected')
    assert.equal(history.inertiaProps.detail.history[0].reason, 'Photos manquantes')
    assert.equal(history.inertiaProps.detail.history[0].decidedByEmail, admin.email)
  })

  test('une cible inconnue ou non modérable renvoie 404 sans rien écrire', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const buyer = await OrganizationFactory.create()

    for (const url of ['organization/999999999', `organization/${buyer.id}`, 'rfq/1']) {
      const response = await decide(client, admin, url, { status: 'approved' })
      response.assertStatus(404)
    }
    const show = await client.get('/fr/admin/moderation/organization/999999999').loginAs(admin)
    show.assertStatus(404)
    assert.lengthOf(await ModerationDecisionRecord.all(), 0)
    assert.lengthOf(await AdminAuditLog.all(), 0)
  })

  test('un rejet retire l’élément de la file d’attente et la décision suivante fait foi', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const supplier = await OrganizationFactory.apply('supplier').create()
    const url = `organization/${supplier.id}`

    await decide(client, admin, url, { status: 'rejected', reason: 'Dossier incomplet' })
    const pending = await queue(client, admin, '?type=organization')
    assert.isFalse(pending.queue.data.some((i) => i.targetId === supplier.id))

    await decide(client, admin, url, { status: 'approved' })
    const approved = await queue(client, admin, '?type=organization&status=approved')
    assert.deepEqual(
      approved.queue.data.map((i) => i.targetId),
      [supplier.id]
    )
    const audit = await AdminAuditLog.query().orderBy('id', 'desc').firstOrFail()
    assert.deepEqual(audit.changes?.before, { status: 'rejected' })
  })
})
