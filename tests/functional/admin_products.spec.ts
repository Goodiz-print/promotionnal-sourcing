import { test } from '@japa/runner'
import emitter from '@adonisjs/core/services/emitter'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import ModerationDecisionRecord from '#models/moderation_decision'
import Product from '#models/product'
import ProductChanged from '#events/product_changed'
import { useDatabase } from '#tests/utils/setup'

interface ProductListItem {
  id: number
  name: string | null
  slug: string
  visibilityStatus: string
}

/**
 * Helper pour les actions sur les produits.
 */
function productAction(
  client: unknown,
  actor: unknown,
  productId: number,
  action: string,
  body?: Record<string, unknown>
) {
  const c = client as any
  let req = c
    .post(`/fr/admin/products/${productId}/${action}`)
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(actor)
  if (body) req = req.json(body)
  return req
}

test.group('Administration produits - liste et droits (#164)', (group) => {
  useDatabase(group, { seed: 'full' })

  test('un admin, un moderateur et un support accedent a la liste', async ({ client }) => {
    for (const role of ['platformAdmin', 'platformModerator', 'platformSupport'] as const) {
      const user = await UserFactory.apply(role).create()
      const response = await client.get('/fr/admin/products').withInertia().loginAs(user)
      response.assertStatus(200)
      response.assertInertiaComponent('admin/products/index')
    }
  })

  test('un analyste ne peut pas acceder a la liste', async ({ client }) => {
    const analyst = await UserFactory.apply('platformAnalyst').create()
    const response = await client.get('/fr/admin/products').withInertia().loginAs(analyst)
    response.assertStatus(403)
  })

  test('un utilisateur ordinaire ne peut pas acceder a la liste', async ({ client }) => {
    const user = await UserFactory.create()
    const response = await client.get('/fr/admin/products').withInertia().loginAs(user)
    response.assertStatus(403)
  })

  test('la liste retourne les produits avec leurs informations', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/products').withInertia().loginAs(admin)

    response.assertStatus(200)
    const products: ProductListItem[] = response.inertiaProps.productList.data
    assert.isArray(products)
    assert.isAbove(products.length, 0)
    // Verifie que les champs sont presents
    const first = products[0]
    assert.property(first, 'id')
    assert.property(first, 'slug')
    assert.property(first, 'visibilityStatus')
    assert.property(first, 'variantsCount')
    assert.property(first, 'imagesCount')
  })

  test('canManage est true pour admin, false pour support', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const support = await UserFactory.apply('platformSupport').create()

    const asAdmin = await client.get('/fr/admin/products').withInertia().loginAs(admin)
    const asSupport = await client.get('/fr/admin/products').withInertia().loginAs(support)

    assert.isTrue(asAdmin.inertiaProps.canManage)
    assert.isFalse(asSupport.inertiaProps.canManage)
  })
})

test.group('Administration produits - filtres (#164)', (group) => {
  useDatabase(group, { seed: 'full' })

  test('une valeur de filtre inconnue est refusee', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    for (const qs of ['visibility=nope', 'quality=nope']) {
      const response = await client
        .get(`/fr/admin/products?${qs}`)
        .header('Accept', 'application/json')
        .loginAs(admin)

      response.assertStatus(422)
    }
  })

  test('filterOptions contient les categories et fournisseurs', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/products').withInertia().loginAs(admin)

    assert.isArray(response.inertiaProps.filterOptions.categories)
    assert.isArray(response.inertiaProps.filterOptions.suppliers)
  })
})

test.group('Administration produits - fiche (#164)', (group) => {
  useDatabase(group, { seed: 'full' })

  test('la fiche d un produit est accessible et contient les details', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().firstOrFail()

    const response = await client
      .get(`/fr/admin/products/${product.id}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/products/show')
    const detail = response.inertiaProps.product
    assert.equal(detail.id, product.id)
    assert.property(detail, 'variants')
    assert.property(detail, 'priceTiers')
    assert.property(detail, 'images')
    assert.property(detail, 'translations')
    assert.property(detail, 'moderationStatus')
    assert.property(detail, 'moderationHistory')
  })

  test('un produit inconnu renvoie 404', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/products/999999').withInertia().loginAs(admin)

    response.assertStatus(404)
  })
})

test.group('Administration produits - actions: masquage (#164)', (group) => {
  useDatabase(group, { seed: 'full' })
  group.each.teardown(() => emitter.restore())

  test('masquer un produit cree une decision de moderation rejected et trace l action', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()

    const response = await productAction(client, admin, product.id, 'hide', {
      reason: 'Contenu inapproprie',
    })

    response.assertStatus(302)

    // Verifie la decision de moderation
    const decision = await ModerationDecisionRecord.query()
      .where('targetType', 'product')
      .where('targetId', product.id)
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.equal(decision.status, 'rejected')
    assert.equal(decision.reason, 'Contenu inapproprie')

    // Verifie l'audit
    const [log] = await AdminAuditLog.query()
      .where('action', 'product.hidden')
      .where('targetId', product.id)
    assert.exists(log)
    assert.equal(log.actorUserId, admin.id)
  })

  test('masquer sans motif est refuse', async ({ client }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()

    const response = await productAction(client, admin, product.id, 'hide', {})

    response.assertStatus(422)
  })

  test('masquer un produit deja masque renvoie une erreur', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()

    // Premier masquage
    await productAction(client, admin, product.id, 'hide', { reason: 'Test' })

    // Deuxieme tentative
    const response = await productAction(client, admin, product.id, 'hide', { reason: 'Test 2' })

    response.assertStatus(302)
    // Pas de nouvel audit
    const logs = await AdminAuditLog.query()
      .where('action', 'product.hidden')
      .where('targetId', product.id)
    assert.equal(logs.length, 1)
  })

  test('reveler un produit masque cree une decision approved', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()

    // Masquer d'abord
    await productAction(client, admin, product.id, 'hide', { reason: 'Test' })

    // Reveler
    const response = await productAction(client, admin, product.id, 'unhide')

    response.assertStatus(302)

    // Verifie la decision de moderation
    const decision = await ModerationDecisionRecord.query()
      .where('targetType', 'product')
      .where('targetId', product.id)
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.equal(decision.status, 'approved')

    // Verifie l'audit
    const [log] = await AdminAuditLog.query()
      .where('action', 'product.unhidden')
      .where('targetId', product.id)
    assert.exists(log)
  })

  test('reveler un produit non masque renvoie une erreur', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()

    const response = await productAction(client, admin, product.id, 'unhide')

    response.assertStatus(302)
    // Pas d'audit
    const logs = await AdminAuditLog.query()
      .where('action', 'product.unhidden')
      .where('targetId', product.id)
    assert.equal(logs.length, 0)
  })
})

test.group('Administration produits - actions: publication (#164)', (group) => {
  useDatabase(group, { seed: 'full' })
  group.each.teardown(() => emitter.restore())

  test('depublier un produit change is_active et trace l action', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()
    const fake = emitter.fake([ProductChanged])

    const response = await productAction(client, admin, product.id, 'unpublish')

    response.assertStatus(302)
    await product.refresh()
    assert.isFalse(product.isActive)

    // Verifie l'audit
    const [log] = await AdminAuditLog.query()
      .where('action', 'product.unpublished')
      .where('targetId', product.id)
    assert.exists(log)

    // Verifie l'evenement de reindexation
    fake.assertEmitted(ProductChanged)
  })

  test('depublier un produit deja depublie renvoie une erreur', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()

    // Depublier d'abord
    await productAction(client, admin, product.id, 'unpublish')

    // Deuxieme tentative
    const response = await productAction(client, admin, product.id, 'unpublish')

    response.assertStatus(302)
    // Un seul audit
    const logs = await AdminAuditLog.query()
      .where('action', 'product.unpublished')
      .where('targetId', product.id)
    assert.equal(logs.length, 1)
  })

  test('publier un produit depublie change is_active', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()

    // Depublier d'abord
    await productAction(client, admin, product.id, 'unpublish')

    // Publier
    const response = await productAction(client, admin, product.id, 'publish')

    response.assertStatus(302)
    await product.refresh()
    assert.isTrue(product.isActive)

    // Verifie l'audit
    const [log] = await AdminAuditLog.query()
      .where('action', 'product.published')
      .where('targetId', product.id)
    assert.exists(log)
  })
})

test.group('Administration produits - actions: archivage (#164)', (group) => {
  useDatabase(group, { seed: 'full' })
  group.each.teardown(() => emitter.restore())

  test('archiver un produit change lifecycle_status et is_active', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query()
      .where('isActive', true)
      .where('lifecycleStatus', '!=', 'retired')
      .firstOrFail()
    const fake = emitter.fake([ProductChanged])

    const response = await productAction(client, admin, product.id, 'archive')

    response.assertStatus(302)
    await product.refresh()
    assert.equal(product.lifecycleStatus, 'retired')
    assert.isFalse(product.isActive)

    // Verifie l'audit
    const [log] = await AdminAuditLog.query()
      .where('action', 'product.archived')
      .where('targetId', product.id)
    assert.exists(log)

    fake.assertEmitted(ProductChanged)
  })

  test('archiver un produit deja archive renvoie une erreur', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('lifecycleStatus', '!=', 'retired').firstOrFail()

    // Archiver d'abord
    await productAction(client, admin, product.id, 'archive')

    // Deuxieme tentative
    const response = await productAction(client, admin, product.id, 'archive')

    response.assertStatus(302)
    // Un seul audit
    const logs = await AdminAuditLog.query()
      .where('action', 'product.archived')
      .where('targetId', product.id)
    assert.equal(logs.length, 1)
  })

  test('restaurer un produit archive change lifecycle_status', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('lifecycleStatus', '!=', 'retired').firstOrFail()

    // Archiver d'abord
    await productAction(client, admin, product.id, 'archive')

    // Restaurer
    const response = await productAction(client, admin, product.id, 'restore')

    response.assertStatus(302)
    await product.refresh()
    assert.equal(product.lifecycleStatus, 'active')
    // is_active reste false (comportement documente)
    assert.isFalse(product.isActive)

    // Verifie l'audit
    const [log] = await AdminAuditLog.query()
      .where('action', 'product.restored')
      .where('targetId', product.id)
    assert.exists(log)
  })
})

test.group('Administration produits - actions: reindexation (#164)', (group) => {
  useDatabase(group, { seed: 'full' })
  group.each.teardown(() => emitter.restore())

  test('demander une reindexation trace l action', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().firstOrFail()

    const response = await productAction(client, admin, product.id, 'reindex')

    response.assertStatus(302)

    // Verifie l'audit
    const [log] = await AdminAuditLog.query()
      .where('action', 'product.reindex_requested')
      .where('targetId', product.id)
    assert.exists(log)
  })
})

test.group('Administration produits - droits sur les actions (#164)', (group) => {
  useDatabase(group, { seed: 'full' })

  test('seul admin peut executer les actions, pas moderateur ni support', async ({ client }) => {
    const product = await Product.query().where('isActive', true).firstOrFail()

    for (const role of ['platformModerator', 'platformSupport'] as const) {
      const user = await UserFactory.apply(role).create()

      const hide = await productAction(client, user, product.id, 'hide', { reason: 'Test' })
      hide.assertStatus(403)

      const unpublish = await productAction(client, user, product.id, 'unpublish')
      unpublish.assertStatus(403)

      const archive = await productAction(client, user, product.id, 'archive')
      archive.assertStatus(403)

      const reindex = await productAction(client, user, product.id, 'reindex')
      reindex.assertStatus(403)
    }
  })

  test('un utilisateur ordinaire ne peut pas executer les actions', async ({ client }) => {
    const user = await UserFactory.create()
    const product = await Product.query().where('isActive', true).firstOrFail()

    const response = await productAction(client, user, product.id, 'hide', { reason: 'Test' })
    response.assertStatus(403)
  })
})
