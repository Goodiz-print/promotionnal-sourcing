import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import app from '@adonisjs/core/services/app'
import searchConfig from '#config/search'
import SearchRemoveUnlinked from '../../commands/search_remove_unlinked.js'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { ProductFactory } from '#database/factories/product_factory'
import { SupplierFactory } from '#database/factories/supplier_factory'
import { UserFactory } from '#database/factories/user_factory'
import type Product from '#models/product'
import Supplier from '#models/supplier'
import AdminSupplierLinkService from '#services/admin_supplier_link_service'
import ProductIndexService from '#services/product_index_service'
import TranslationQueueService from '#services/translation_queue_service'
import TranslateEntityJob from '#jobs/translate_entity_job'
import TranslationBackfillJob from '#jobs/translation_backfill_job'
import ProductSearchService, { type CatalogueSearchOptions } from '#services/product_search_service'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'
import type { ApiClient } from '@japa/api-client'

/**
 * Publication réservée aux fiches rattachées (#240) : une fiche fournisseur
 * sans organisation et ses produits restent en base mais ne sont ni au
 * catalogue, ni dans la recherche, ni sur une URL publique, ni dans l'index.
 */

/** Produit d'une fiche **non rattachée** (import en attente d'accord). */
async function unlinkedProduct(): Promise<Product> {
  const supplier = await SupplierFactory.create()
  return ProductFactory.merge({ supplierId: supplier.id }).with('category').create()
}

/** Produit d'une fiche rattachée à une organisation fournisseuse. */
async function linkedProduct(): Promise<Product> {
  const organization = await OrganizationFactory.apply('supplier').create()
  const supplier = await SupplierFactory.merge({ organizationId: organization.id }).create()
  return ProductFactory.merge({ supplierId: supplier.id }).with('category').create()
}

async function catalogueSlugs(client: ApiClient): Promise<string[]> {
  const response = await client.get('/fr/products').withInertia()
  response.assertStatus(200)
  return response.inertiaProps.products.data.map((product: { slug: string }) => product.slug)
}

const SEARCH: CatalogueSearchOptions = {
  search: 'stylo',
  categoryId: null,
  madeInEurope: false,
  attributeValueIds: [],
  certificationIds: [],
  originZones: [],
  stockStatuses: [],
  priceBuckets: [],
  moqBuckets: [],
  attributeRanges: [],
  newOnly: false,
  ecoOnly: false,
  page: 1,
  perPage: 12,
}

test.group('Publication — fiches non rattachées (#240)', (group) => {
  useDatabase(group)

  test('le catalogue ne liste que les produits des fiches rattachées', async ({
    client,
    assert,
  }) => {
    const hidden = await unlinkedProduct()
    const shown = await linkedProduct()

    const slugs = await catalogueSlugs(client)

    assert.include(slugs, shown.slug)
    assert.notInclude(slugs, hidden.slug)
  })

  test("l'URL publique d'un produit ou d'une fiche non rattachée est un 404", async ({
    client,
  }) => {
    const product = await unlinkedProduct()
    const supplier = await Supplier.findOrFail(product.supplierId)

    const productPage = await client.get(`/fr/products/${product.slug}`)
    productPage.assertStatus(404)
    const supplierPage = await client.get(`/fr/suppliers/${supplier.slug}`)
    supplierPage.assertStatus(404)
  })

  test('rattacher une fiche publie ses produits, la détacher les retire', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const organization = await OrganizationFactory.apply('supplier').create()
    const product = await unlinkedProduct()
    const links = await app.container.make(AdminSupplierLinkService)
    const context = { actor: admin, ip: null }

    await links.link({ supplierId: product.supplierId, organizationId: organization.id, context })
    assert.include(await catalogueSlugs(client), product.slug)
    const published = await client.get(`/fr/products/${product.slug}`)
    published.assertStatus(200)

    await links.unlink({ supplierId: product.supplierId, context })
    assert.notInclude(await catalogueSlugs(client), product.slug)
    const unpublished = await client.get(`/fr/products/${product.slug}`)
    unpublished.assertStatus(404)
  })
})

test.group('Publication — recherche et index (#240)', (group) => {
  useDatabase(group)

  let handle: FakeEngineHandle
  const batchSize = searchConfig.batchSize
  group.each.setup(() => {
    handle = installFakeEngine(true)
    ace.ui.switchMode('raw')
    return () => {
      handle.restore()
      searchConfig.batchSize = batchSize
      ace.ui.switchMode('normal')
    }
  })

  test('la recherche écarte un produit non rattaché renvoyé par le moteur', async ({ assert }) => {
    const hidden = await unlinkedProduct()
    const shown = await linkedProduct()
    handle.engine.hits = { ids: [hidden.id, shown.id], total: 2 }

    const search = await app.container.make(ProductSearchService)
    const page = await search.search(SEARCH)

    const ids = page!.all().map((product) => product.id)
    assert.deepEqual(ids, [shown.id])
  })

  test("la synchronisation retire de l'index un produit non rattaché", async ({ assert }) => {
    const hidden = await unlinkedProduct()
    const shown = await linkedProduct()

    const index = await app.container.make(ProductIndexService)
    const result = await index.sync([hidden.id, shown.id])

    assert.deepEqual(result, { indexed: 1, removed: 1 })
    assert.deepEqual(handle.engine.removed, [[hidden.id]])
    assert.deepEqual(
      handle.engine.upserted.flat().map((document) => document.id),
      [shown.id]
    )
  })

  test('removeUnlinkedProducts retire par lots les seuls produits non rattachés', async ({
    assert,
  }) => {
    searchConfig.batchSize = 2
    const hidden = await Promise.all([unlinkedProduct(), unlinkedProduct(), unlinkedProduct()])
    await linkedProduct()
    const progress: number[] = []

    const index = await app.container.make(ProductIndexService)
    const removed = await index.removeUnlinkedProducts((scanned) => {
      progress.push(scanned)
    })

    assert.equal(removed, 3)
    assert.sameMembers(
      handle.engine.removed.flat(),
      hidden.map((product) => product.id)
    )
    assert.deepEqual(
      handle.engine.removed.map((batch) => batch.length),
      [2, 1]
    )
    assert.deepEqual(progress, [2, 3])
    assert.lengthOf(handle.engine.upserted, 0)
  })

  test('removeUnlinkedProducts sans fiche non rattachée ne retire rien', async ({ assert }) => {
    await linkedProduct()

    const index = await app.container.make(ProductIndexService)

    assert.equal(await index.removeUnlinkedProducts(), 0)
    assert.lengthOf(handle.engine.removed, 0)
  })

  test("search:remove-unlinked retire de l'index les produits non rattachés", async ({
    assert,
  }) => {
    const hidden = await unlinkedProduct()
    const shown = await linkedProduct()

    const command = await ace.create(SearchRemoveUnlinked, [])
    await command.exec()

    assert.equal(command.exitCode, 0)
    assert.include(handle.engine.removed.flat(), hidden.id)
    assert.notInclude(handle.engine.removed.flat(), shown.id)
    command.assertLog("[ green(success) ] 1 produit(s) retiré(s) de l'index.")
  })
})

test.group('Publication — search:remove-unlinked sans moteur (#240)', (group) => {
  useDatabase(group)

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine(false)
    ace.ui.switchMode('raw')
    return () => {
      handle.restore()
      ace.ui.switchMode('normal')
    }
  })

  test('sans MEILISEARCH_HOST, la commande prévient et ne touche à rien', async ({ assert }) => {
    await unlinkedProduct()

    const command = await ace.create(SearchRemoveUnlinked, [])
    await command.exec()

    assert.equal(command.exitCode, 0)
    assert.lengthOf(handle.engine.removed, 0)
    command.assertLog(
      '[ yellow(warn) ] MEILISEARCH_HOST est absent : renseignez-le, puis relancez.'
    )
  })
})

test.group('Back-office — fiches à rattacher (#240)', (group) => {
  useDatabase(group)

  test('pendingCount compte les seules fiches sans organisation', async ({ assert }) => {
    const organization = await OrganizationFactory.apply('supplier').create()
    await SupplierFactory.createMany(2)
    await SupplierFactory.merge({ organizationId: organization.id }).create()

    const links = await app.container.make(AdminSupplierLinkService)

    assert.equal(await links.pendingCount(), 2)
  })

  test('le tableau de bord expose le nombre de fiches à rattacher', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await SupplierFactory.createMany(3)

    const response = await client.get('/fr/admin').withInertia().loginAs(admin)

    response.assertStatus(200)
    assert.equal(response.inertiaProps.stats.pendingSupplierLinks, 3)
  })
})

test.group('Publication — traduction au rattachement (#240)', (group) => {
  useDatabase(group)

  test('queueSupplier traduit les seuls produits de la fiche', async ({ assert }) => {
    const product = await linkedProduct()
    await linkedProduct()
    const translated: number[] = []
    const original = TranslateEntityJob.dispatch
    TranslateEntityJob.dispatch = ((payload: { entityId: number }) => {
      translated.push(payload.entityId)
    }) as unknown as typeof TranslateEntityJob.dispatch

    try {
      const translations = await app.container.make(TranslationQueueService)
      assert.isTrue(await translations.queueSupplier(product.supplierId))
    } finally {
      TranslateEntityJob.dispatch = original
    }
    assert.deepEqual(translated, [product.id])
  })

  test('queueSupplier ne fait pas échouer le rattachement si la file refuse', async ({
    assert,
  }) => {
    const original = TranslationBackfillJob.dispatch
    TranslationBackfillJob.dispatch = (() => {
      throw new Error('queue down')
    }) as unknown as typeof TranslationBackfillJob.dispatch

    try {
      const translations = await app.container.make(TranslationQueueService)
      assert.isFalse(await translations.queueSupplier(1))
    } finally {
      TranslationBackfillJob.dispatch = original
    }
  })
})
