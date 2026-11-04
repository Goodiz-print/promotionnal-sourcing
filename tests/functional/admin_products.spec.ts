import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import emitter from '@adonisjs/core/services/emitter'
import app from '@adonisjs/core/services/app'
import { UserFactory } from '#database/factories/user_factory'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { CategoryFactory } from '#database/factories/category_factory'
import { ProductFactory } from '#database/factories/product_factory'
import { ProductVariantFactory } from '#database/factories/product_variant_factory'
import { ProductImageFactory } from '#database/factories/product_image_factory'
import { ProductTranslationFactory } from '#database/factories/product_translation_factory'
import AdminAuditLog from '#models/admin_audit_log'
import ModerationDecisionRecord from '#models/moderation_decision'
import Product from '#models/product'
import ProductChanged from '#events/product_changed'
import SearchSyncService from '#services/search_sync_service'
import { useDatabase } from '#tests/utils/setup'
import { TRANSLATION_LOCALES } from '#shared/types/i18n'
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

  test('quality=no_image inclut les produits sans image et exclut ceux qui en ont une', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    // Produit sans image : doit apparaitre dans le filtre
    const productWithoutImage = await ProductFactory.with('supplier').with('category').create()
    // Produit avec une image : doit etre exclu du filtre
    const productWithImage = await ProductFactory.with('supplier').with('category').create()
    await ProductImageFactory.merge({ productId: productWithImage.id }).create()

    const response = await client
      .get('/fr/admin/products?quality=no_image')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    assert.include(slugs, productWithoutImage.slug)
    assert.notInclude(slugs, productWithImage.slug)
  })

  test('quality=no_translation inclut les produits incomplets et exclut ceux avec toutes les traductions', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    // Produit avec toutes les traductions (32) : doit etre exclu du filtre
    const fullProduct = await ProductFactory.with('supplier').with('category').create()
    for (const locale of TRANSLATION_LOCALES) {
      await ProductTranslationFactory.merge({ productId: fullProduct.id, locale }).create()
    }

    // Produit sans traduction : doit etre inclus dans le filtre
    const emptyProduct = await ProductFactory.with('supplier').with('category').create()

    const response = await client
      .get('/fr/admin/products?quality=no_translation')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    assert.notInclude(slugs, fullProduct.slug)
    assert.include(slugs, emptyProduct.slug)
  })

  test('quality=no_variant inclut les produits sans variante et exclut ceux qui en ont une', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    // Produit avec une variante : doit etre exclu du filtre
    const productWithVariant = await ProductFactory.with('supplier').with('category').create()
    await ProductVariantFactory.merge({ productId: productWithVariant.id }).create()

    // Produit sans variante : doit apparaitre dans le filtre
    const productWithoutVariant = await ProductFactory.with('supplier').with('category').create()

    const response = await client
      .get('/fr/admin/products?quality=no_variant')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    assert.include(slugs, productWithoutVariant.slug)
    assert.notInclude(slugs, productWithVariant.slug)
  })

  test('search par slug retourne le bon produit et pas les autres', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const target = await ProductFactory.with('supplier').with('category').create()
    const other = await ProductFactory.with('supplier').with('category').create()

    const response = await client
      .get(`/fr/admin/products?search=${encodeURIComponent(target.slug)}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    assert.include(slugs, target.slug)
    assert.notInclude(slugs, other.slug)
  })

  test('search par nom traduit retourne le bon produit', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const target = await ProductFactory.with('supplier').with('category').create()
    const uniqueName = `ProduitSpec${target.id}`
    await ProductTranslationFactory.merge({
      productId: target.id,
      locale: 'fr',
      name: uniqueName,
    }).create()

    const other = await ProductFactory.with('supplier').with('category').create()
    await ProductTranslationFactory.merge({
      productId: other.id,
      locale: 'fr',
      name: `ProduitAutre${other.id}`,
    }).create()

    const response = await client
      .get(`/fr/admin/products?search=${encodeURIComponent(uniqueName)}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    assert.include(slugs, target.slug)
    assert.notInclude(slugs, other.slug)
  })

  test('search par nom d organisation retourne ses produits', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const org = await OrganizationFactory.apply('supplier').create()
    const supplier = await SupplierFactory.merge({ organizationId: org.id }).create()
    const category = await CategoryFactory.create()

    const product1 = await ProductFactory.merge({
      supplierId: supplier.id,
      categoryId: category.id,
    }).create()
    const product2 = await ProductFactory.merge({
      supplierId: supplier.id,
      categoryId: category.id,
    }).create()

    // Produit d'un autre fournisseur sans organisation : ne doit pas apparaitre
    const otherSupplier = await SupplierFactory.create()
    const otherProduct = await ProductFactory.merge({
      supplierId: otherSupplier.id,
      categoryId: category.id,
    }).create()

    const response = await client
      .get(`/fr/admin/products?search=${encodeURIComponent(org.name)}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    assert.include(slugs, product1.slug)
    assert.include(slugs, product2.slug)
    assert.notInclude(slugs, otherProduct.slug)
  })

  test('filtre supplierId retourne uniquement les produits du fournisseur', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const org = await OrganizationFactory.apply('supplier').create()
    const supplier = await SupplierFactory.merge({ organizationId: org.id }).create()
    const category = await CategoryFactory.create()

    const product1 = await ProductFactory.merge({
      supplierId: supplier.id,
      categoryId: category.id,
    }).create()
    const product2 = await ProductFactory.merge({
      supplierId: supplier.id,
      categoryId: category.id,
    }).create()

    // Produit d'un autre fournisseur : doit etre exclu
    const otherSupplier = await SupplierFactory.create()
    const otherProduct = await ProductFactory.merge({
      supplierId: otherSupplier.id,
      categoryId: category.id,
    }).create()

    const response = await client
      .get(`/fr/admin/products?supplierId=${org.id}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    assert.include(slugs, product1.slug)
    assert.include(slugs, product2.slug)
    assert.notInclude(slugs, otherProduct.slug)
  })

  test('filtre categoryId inclut les sous-categories', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const parentCat = await CategoryFactory.create()
    const childCat = await CategoryFactory.merge({ parentId: parentCat.id }).create()
    const otherCat = await CategoryFactory.create()

    const supplier = await SupplierFactory.create()

    const parentProduct = await ProductFactory.merge({
      supplierId: supplier.id,
      categoryId: parentCat.id,
    }).create()
    const childProduct = await ProductFactory.merge({
      supplierId: supplier.id,
      categoryId: childCat.id,
    }).create()
    const otherProduct = await ProductFactory.merge({
      supplierId: supplier.id,
      categoryId: otherCat.id,
    }).create()

    const response = await client
      .get(`/fr/admin/products?categoryId=${parentCat.id}`)
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const slugs = response.inertiaProps.productList.data.map((p: ProductListItem) => p.slug)
    // Le produit dans la categorie parente est inclus
    assert.include(slugs, parentProduct.slug)
    // Le produit dans la sous-categorie est aussi inclus
    assert.include(slugs, childProduct.slug)
    // Le produit hors de cette branche est exclu
    assert.notInclude(slugs, otherProduct.slug)
  })

  test('la pagination retourne la page 2 quand il y a plus de 25 produits', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const supplier = await SupplierFactory.create()
    const category = await CategoryFactory.create()

    // Cree 26 produits pour deborder sur la page 2 (perPage=25)
    await ProductFactory.merge({ supplierId: supplier.id, categoryId: category.id }).createMany(26)

    const response = await client.get('/fr/admin/products?page=2').withInertia().loginAs(admin)

    response.assertStatus(200)
    assert.isAbove(response.inertiaProps.productList.data.length, 0)
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
    // `ModerationService.decide` émet `ProductChanged` après le commit : l'index suit.
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
    // Verifie les champs before/after de l'audit
    assert.isFalse(log.changes?.before?.hidden as boolean)
    assert.isTrue(log.changes?.after?.hidden as boolean)

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
    // Verifie les champs before/after de l'audit
    assert.isTrue(log.changes?.before?.hidden as boolean)
    assert.isFalse(log.changes?.after?.hidden as boolean)
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

  test('publish sur un produit archive est refuse, is_active reste false, pas d audit published', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    emitter.fake([ProductChanged])

    const product = await ProductFactory.with('supplier').with('category').apply('retired').create()

    const response = await productAction(client, admin, product.id, 'publish')

    // Le controleur redirige avec un flash d'erreur (ProductArchivedException => 302)
    response.assertStatus(302)

    // Le produit reste archive et inactif
    await product.refresh()
    assert.isFalse(product.isActive)
    assert.equal(product.lifecycleStatus, 'retired')

    // Aucune entree d'audit product.published ne doit avoir ete creee
    const logs = await AdminAuditLog.query()
      .where('action', 'product.published')
      .where('targetId', product.id)
    assert.equal(logs.length, 0)
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
