import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import emitter from '@adonisjs/core/services/emitter'
import app from '@adonisjs/core/services/app'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import ModerationDecisionRecord from '#models/moderation_decision'
import Product from '#models/product'
import Supplier from '#models/supplier'
import Category from '#models/category'
import ProductChanged from '#events/product_changed'
import SearchSyncService from '#services/search_sync_service'
import { useDatabase } from '#tests/utils/setup'
import type User from '#models/user'

interface ProductListItem {
  id: number
  name: string | null
  slug: string
  visibilityStatus: string
  variantsCount: number
  imagesCount: number
}

/**
 * Helper pour les actions sur les produits.
 */
function productAction(
  client: ApiClient,
  actor: User,
  productId: number,
  action: string,
  body?: Record<string, unknown>
) {
  let req = client
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

test.group('Administration produits - filtres actifs (#164)', (group) => {
  useDatabase(group, { seed: 'full' })
  group.each.teardown(() => emitter.restore())

  test('visibility=published exclut un produit depublie', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()
    emitter.fake([ProductChanged])

    // Depublier le produit via l'API
    await productAction(client, admin, product.id, 'unpublish')

    const response = await client
      .get('/fr/admin/products?visibility=published')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const ids = response.inertiaProps.productList.data.map((p: ProductListItem) => p.id)
    assert.notInclude(ids, product.id)
  })

  test('visibility=unpublished retourne uniquement les produits depublies', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()
    emitter.fake([ProductChanged])

    // Avant depublication : pas de produits depublies parmi les seedes
    const before = await client
      .get('/fr/admin/products?visibility=unpublished')
      .withInertia()
      .loginAs(admin)
    const idsBefore = before.inertiaProps.productList.data.map((p: ProductListItem) => p.id)
    assert.notInclude(idsBefore, product.id)

    // Depublier
    await productAction(client, admin, product.id, 'unpublish')

    // Apres depublication : le produit apparait dans la liste des depublies
    const after = await client
      .get('/fr/admin/products?visibility=unpublished')
      .withInertia()
      .loginAs(admin)
    const idsAfter = after.inertiaProps.productList.data.map((p: ProductListItem) => p.id)
    assert.include(idsAfter, product.id)
  })

  test('visibility=hidden retourne un produit masque et le retire de published', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()
    emitter.fake([ProductChanged])

    await productAction(client, admin, product.id, 'hide', { reason: 'Test filtre' })

    const hidden = await client
      .get('/fr/admin/products?visibility=hidden')
      .withInertia()
      .loginAs(admin)
    const hiddenIds = hidden.inertiaProps.productList.data.map((p: ProductListItem) => p.id)
    assert.include(hiddenIds, product.id)

    // Un produit masque ne doit pas apparaitre dans published
    const published = await client
      .get('/fr/admin/products?visibility=published')
      .withInertia()
      .loginAs(admin)
    const publishedIds = published.inertiaProps.productList.data.map((p: ProductListItem) => p.id)
    assert.notInclude(publishedIds, product.id)
  })

  test('visibility=archived retourne uniquement les produits archives', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('lifecycleStatus', '!=', 'retired').firstOrFail()
    emitter.fake([ProductChanged])

    await productAction(client, admin, product.id, 'archive')

    const response = await client
      .get('/fr/admin/products?visibility=archived')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const ids = response.inertiaProps.productList.data.map((p: ProductListItem) => p.id)
    assert.include(ids, product.id)
  })

  test('quality=no_image retourne les produits sans image (tous les seedes)', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/products?quality=no_image')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    // Tous les produits seedes n'ont pas d'image
    assert.isAbove(response.inertiaProps.productList.data.length, 0)
    for (const p of response.inertiaProps.productList.data as ProductListItem[]) {
      assert.equal(p.imagesCount, 0, `produit ${p.id} ne devrait pas avoir d'image`)
    }
  })

  test('quality=no_translation retourne les produits avec moins de 32 traductions', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/products?quality=no_translation')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    // Tous les produits seedes n'ont que 2 traductions (fr, en)
    assert.isAbove(response.inertiaProps.productList.data.length, 0)
  })

  test('quality=no_variant retourne les produits sans variante (tous les seedes)', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/products?quality=no_variant')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    // Tous les produits seedes n'ont pas de variante
    assert.isAbove(response.inertiaProps.productList.data.length, 0)
    for (const p of response.inertiaProps.productList.data as ProductListItem[]) {
      assert.equal(p.variantsCount, 0, `produit ${p.id} ne devrait pas avoir de variante`)
    }
  })

  test('search par slug retourne le bon produit et pas les autres', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/products?search=crayon-hb-bleu')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    assert.include(slugs, 'crayon-hb-bleu')
    assert.notInclude(slugs, 'stylo-bille-bleu')
    assert.notInclude(slugs, 'sac-coton-bleu')
  })

  test('search par nom traduit retourne le bon produit', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client
      .get('/fr/admin/products?search=Aquarelle')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    assert.include(slugs, 'crayon-aquarelle-bleu')
    assert.notInclude(slugs, 'crayon-hb-bleu')
    assert.notInclude(slugs, 'stylo-bille-bleu')
  })

  test('search par nom d organisation retourne ses produits', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    // EuroGoods est l'organisation liee au fournisseur eurogoods (seeder)
    const response = await client
      .get('/fr/admin/products?search=EuroGoods')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    // Les produits du fournisseur eurogoods (organisation EuroGoods)
    assert.include(slugs, 'crayon-hb-bleu')
    assert.include(slugs, 'crayon-hb-rouge')
    assert.include(slugs, 'casquette-6-panneaux-marine')
    // Les produits d'autres fournisseurs ne sont pas concernes
    assert.notInclude(slugs, 'stylo-bille-bleu')
    assert.notInclude(slugs, 'sac-coton-bleu')
  })

  test('filtre supplierId retourne uniquement les produits du fournisseur', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const eurogoods = await Supplier.findByOrFail('slug', 'eurogoods')
    // Si le seeder n'a pas cree l'organisation (cas improbable), on saute
    if (!eurogoods.organizationId) return

    const response = await client
      .get(`/fr/admin/products?supplierId=${eurogoods.organizationId}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    // Produits du fournisseur eurogoods
    assert.include(slugs, 'crayon-hb-bleu')
    assert.include(slugs, 'crayon-hb-rouge')
    assert.include(slugs, 'casquette-6-panneaux-marine')
    // Produits d'autres fournisseurs exclus
    assert.notInclude(slugs, 'stylo-bille-bleu')
    assert.notInclude(slugs, 'sac-coton-bleu')
    assert.notInclude(slugs, 'crayon-aquarelle-bleu')
  })

  test('filtre categoryId inclut les sous-categories', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    // casquettes-chapeaux (N1) contient casquettes-chapeaux-casquettes (N2)
    // casquette-6-panneaux-marine est dans la sous-categorie
    const parentCategory = await Category.findByOrFail('slug', 'casquettes-chapeaux')

    const response = await client
      .get(`/fr/admin/products?categoryId=${parentCategory.id}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    // La casquette est dans une sous-categorie de casquettes-chapeaux
    assert.include(slugs, 'casquette-6-panneaux-marine')
    // Les crayons et stylos ne sont pas dans cette branche
    assert.notInclude(slugs, 'crayon-hb-bleu')
    assert.notInclude(slugs, 'stylo-bille-bleu')
  })

  test('la page 2 est vide quand le catalogue tient sur une seule page', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/products?page=2').withInertia().loginAs(admin)

    response.assertStatus(200)
    // Les 7 produits seedes tiennent sur la page 1 (perPage=25)
    assert.equal(response.inertiaProps.productList.data.length, 0)
    assert.equal(response.inertiaProps.productList.meta.currentPage, 2)
  })

  test('un produit masque est exclu du scope notRejected', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()
    emitter.fake([ProductChanged])

    // Masquer le produit
    await productAction(client, admin, product.id, 'hide', { reason: 'Test scope' })

    // Le scope notRejected (utilise par la recherche publique) doit exclure le produit masque
    const visible = await Product.query().withScopes((q) => q.notRejected())
    const visibleIds = visible.map((p) => p.id)
    assert.notInclude(visibleIds, product.id)
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
    // NOTE : hide devrait emettre ProductChanged pour que l'index soit mis a jour
    // (retrait du produit masque). Le test ci-dessous ECHOUERA tant que le service
    // n'appelle pas emitProductChanged — cf. bug signale dans le rapport.
    const fake = emitter.fake([ProductChanged])

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

    // `ModerationService.decide` émet `ProductChanged` après le commit de la transaction.
    fake.assertEmitted(ProductChanged)
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

  test('demander une reindexation trace l action et met le job en file', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().firstOrFail()

    // Injecter un espion pour SearchSyncService : no-op sans MEILISEARCH_HOST
    // mais le service doit quand meme etre appele pour mettre le job en file.
    let queuedProductId: number | null = null
    app.container.swap(
      SearchSyncService,
      () =>
        ({
          queueProduct: async (id: number) => {
            queuedProductId = id
          },
          queueOrganization: async (_id: number) => {},
        }) as unknown as SearchSyncService
    )

    try {
      const response = await productAction(client, admin, product.id, 'reindex')

      response.assertStatus(302)

      // Verifie l'audit
      const [log] = await AdminAuditLog.query()
        .where('action', 'product.reindex_requested')
        .where('targetId', product.id)
      assert.exists(log)

      // Verifie que le job a ete mis en file via SearchSyncService
      assert.equal(queuedProductId, product.id)
    } finally {
      app.container.restore(SearchSyncService)
    }
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
