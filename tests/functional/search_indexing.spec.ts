import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import searchConfig from '#config/search'
import { UserFactory } from '#database/factories/user_factory'
import ProductChanged from '#events/product_changed'
import Organization from '#models/organization'
import Product from '#models/product'
import ModerationService from '#services/moderation_service'
import OrganizationService from '#services/organization_service'
import ProductIndexService from '#services/product_index_service'
import SearchEngine from '#services/search/search_engine'
import { useDatabase } from '#tests/utils/setup'
import { SEARCH_EMBEDDER, type ProductSearchDocument } from '#shared/types/search'

/**
 * Synchronisation PostgreSQL → index de recherche (#112). Le moteur est un
 * double qui enregistre ses appels : on vérifie ce que l'application envoie,
 * pas Meilisearch.
 */
class FakeSearchEngine extends SearchEngine {
  enabled = true
  upserted: ProductSearchDocument[][] = []
  removed: number[][] = []
  replaced: ProductSearchDocument[][] = []

  async upsert(documents: ProductSearchDocument[]) {
    if (documents.length > 0) this.upserted.push(documents)
  }

  async remove(ids: number[]) {
    if (ids.length > 0) this.removed.push(ids)
  }

  async replaceAll(batches: AsyncIterable<ProductSearchDocument[]>) {
    let count = 0
    for await (const batch of batches) {
      this.replaced.push(batch)
      count += batch.length
    }
    return count
  }

  get indexedIds(): number[] {
    return this.upserted.flat().map((document) => document.id)
  }
}

/** Active la recherche le temps d'un test, avec un moteur factice. */
function useFakeEngine(group: Parameters<typeof useDatabase>[0], enabled = true) {
  const state = { engine: new FakeSearchEngine() }
  const previous = { enabled: searchConfig.enabled, batchSize: searchConfig.batchSize }

  group.each.setup(async () => {
    state.engine = new FakeSearchEngine()
    state.engine.enabled = enabled
    searchConfig.enabled = enabled
    app.container.swap(SearchEngine, () => state.engine)
    return () => {
      searchConfig.enabled = previous.enabled
      searchConfig.batchSize = previous.batchSize
      app.container.restore(SearchEngine)
    }
  })
  return state
}

test.group('Recherche — documents d’index', (group) => {
  useDatabase(group, { seed: 'full' })
  const fake = useFakeEngine(group)

  async function service() {
    return app.container.make(ProductIndexService)
  }

  test('un produit visible est indexé avec ses noms par langue et ses facettes', async ({
    assert,
  }) => {
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    await product.load('translations')
    await product.load('productAttributes')

    const index = await service()
    const result = await index.sync([product.id])

    assert.deepEqual(result, { indexed: 1, removed: 0 })
    const [document] = fake.engine.upserted[0]
    assert.equal(document.id, product.id)
    assert.equal(document.slug, 'crayon-hb-bleu')
    assert.equal(document.categoryId, product.categoryId)
    for (const translation of product.translations) {
      assert.equal(document.names[translation.locale as 'fr'], translation.name)
    }
    assert.sameMembers(
      document.attributeValueIds,
      product.productAttributes.map((row) => row.attributeValueId!).filter(Boolean)
    )
    assert.isNull(document._vectors[SEARCH_EMBEDDER])
  })

  test('le vecteur stocké en base est repris tel quel', async ({ assert }) => {
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const vector = Array.from({ length: 1024 }, (_, index) => (index % 7) / 8)
    await db.rawQuery('UPDATE products SET embedding = ?::halfvec WHERE id = ?', [
      `[${vector.join(',')}]`,
      product.id,
    ])

    const index = await service()
    await index.sync([product.id])

    const [document] = fake.engine.upserted[0]
    assert.lengthOf(document._vectors[SEARCH_EMBEDDER]!, 1024)
    assert.closeTo(document._vectors[SEARCH_EMBEDDER]![7], vector[7], 0.01)
  })

  test('un produit inactif, rejeté ou inexistant est retiré de l’index', async ({ assert }) => {
    const products = await Product.query().orderBy('id').limit(2)
    const [inactive, rejected] = products
    await inactive.merge({ isActive: false }).save()
    const reviewer = await UserFactory.apply('platformAdmin').create()
    await new ModerationService().decide({
      targetType: 'product',
      targetId: rejected.id,
      status: 'rejected',
      decidedBy: reviewer,
    })
    fake.engine.removed = []

    const index = await service()
    const result = await index.sync([inactive.id, rejected.id, 999_999])

    assert.deepEqual(result, { indexed: 0, removed: 3 })
    assert.sameMembers(fake.engine.removed.flat(), [inactive.id, rejected.id, 999_999])
    assert.lengthOf(fake.engine.upserted, 0)
  })

  test('rejouer la même synchronisation donne le même résultat', async ({ assert }) => {
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const index = await service()

    await index.sync([product.id, product.id])
    await index.sync([product.id])

    assert.lengthOf(fake.engine.upserted, 2)
    assert.deepEqual(fake.engine.upserted[0], fake.engine.upserted[1])
  })

  test('l’archivage d’une organisation retire tout son catalogue', async ({ assert }) => {
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const row = await db
      .from('suppliers')
      .where('id', product.supplierId)
      .select('organization_id')
      .firstOrFail()
    const organization = await Organization.findOrFail(row.organization_id)
    const owned = await db
      .from('products')
      .join('suppliers', 'suppliers.id', 'products.supplier_id')
      .where('suppliers.organization_id', organization.id)
      .select('products.id')
    fake.engine.upserted = []
    fake.engine.removed = []

    const organizations = await app.container.make(OrganizationService)
    await organizations.archive(organization)

    assert.sameMembers(
      fake.engine.removed.flat(),
      owned.map((entry: { id: number }) => entry.id)
    )
    assert.lengthOf(fake.engine.upserted, 0)
  })

  test('la réindexation complète envoie tous les produits visibles, par lots', async ({
    assert,
  }) => {
    searchConfig.batchSize = 3
    const rejected = await Product.query().orderBy('id').firstOrFail()
    const reviewer = await UserFactory.apply('platformAdmin').create()
    await new ModerationService().decide({
      targetType: 'product',
      targetId: rejected.id,
      status: 'rejected',
      decidedBy: reviewer,
    })
    const visible = await Product.query()
      .where('isActive', true)
      .withScopes((scopes) => {
        scopes.fromLiveOrganization()
        scopes.notRejected()
      })

    const index = await service()
    const count = await index.reindexAll()

    const sent = fake.engine.replaced.flat().map((document) => document.id)
    assert.equal(count, visible.length)
    assert.sameMembers(
      sent,
      visible.map((product) => product.id)
    )
    assert.notInclude(sent, rejected.id)
    assert.isTrue(fake.engine.replaced.every((batch) => batch.length <= 3))
  })
})

test.group('Recherche — déclencheurs de synchronisation', (group) => {
  useDatabase(group, { seed: 'full' })

  test('un événement produit met en queue la synchronisation, traitée par le job', async ({
    assert,
  }) => {
    const state = useFakeEngineOnce()
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')

    await emitter.emit(ProductChanged, new ProductChanged(product.id))

    assert.deepEqual(state.engine.indexedIds, [product.id])
    state.restore()
  })

  test('sans MEILISEARCH_HOST, rien n’est mis en queue ni envoyé', async ({ assert }) => {
    const state = useFakeEngineOnce(false)
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')

    await emitter.emit(ProductChanged, new ProductChanged(product.id))

    assert.lengthOf(state.engine.upserted, 0)
    assert.lengthOf(state.engine.removed, 0)
    state.restore()
  })

  test('la modération d’un produit retire sa fiche de l’index', async ({ assert }) => {
    const state = useFakeEngineOnce()
    const product = await Product.findByOrFail('slug', 'crayon-hb-bleu')
    const reviewer = await UserFactory.apply('platformAdmin').create()

    await new ModerationService().decide({
      targetType: 'product',
      targetId: product.id,
      status: 'rejected',
      decidedBy: reviewer,
    })

    assert.deepEqual(state.engine.removed, [[product.id]])
    state.restore()
  })
})

/** Variante sans hook de groupe, pour les tests qui basculent le moteur eux-mêmes. */
function useFakeEngineOnce(enabled = true) {
  const engine = new FakeSearchEngine()
  engine.enabled = enabled
  const previous = searchConfig.enabled
  searchConfig.enabled = enabled
  app.container.swap(SearchEngine, () => engine)
  return {
    engine,
    restore() {
      searchConfig.enabled = previous
      app.container.restore(SearchEngine)
    },
  }
}
