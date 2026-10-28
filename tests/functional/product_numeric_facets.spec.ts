import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import Attribute from '#models/attribute'
import Category from '#models/category'
import Product from '#models/product'
import ProductAttribute from '#models/product_attribute'
import ProductIndexService from '#services/product_index_service'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'

/**
 * Facettes à tranches numériques (plan L125) : prix (palier le plus bas) et MOQ
 * indexés et filtrables, tranches d'attributs EAV filtrables. On éprouve le
 * document d'index, la transmission au moteur (parsing contrôleur) et le repli
 * PostgreSQL, avec la sémantique `[min, max[`.
 */

/** Crée un produit fournisseur visible, avec prix et MOQ (sans palier → prix conservé). */
async function createProduct(
  client: ApiClient,
  slug: string,
  fields: { priceMin?: number | null; minQuantity?: number | null } = {}
): Promise<Product> {
  const user = await seededDevUser('eurogoods-org')
  const crayon = await Category.findByOrFail('slug', 'crayon')

  const response = await client
    .post('/fr/supplier/products')
    .withInertia()
    .withCsrfToken()
    .loginAs(user)
    .json({
      categoryId: crayon.id,
      sourceLocale: 'fr',
      translations: {
        fr: { name: slug, description: null },
        en: { name: slug, description: null },
      },
      isActive: true,
      ...fields,
    })
  response.assertStatus(200)

  return Product.query().where('slug', slug).firstOrFail()
}

async function catalogueSlugs(client: ApiClient, qs: Record<string, unknown>): Promise<string[]> {
  const response = await client.get('/fr/products').qs(qs).withInertia()
  return response.inertiaProps.products.data.map((p: { slug: string }) => p.slug)
}

test.group('Facettes numériques — indexation', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine(true)
    return () => handle.restore()
  })

  test('le document porte priceMin (nombre) et moq', async ({ client, assert }) => {
    const product = await createProduct(client, 'num-doc', { priceMin: 3.5, minQuantity: 150 })
    handle.engine.upserted = []

    const index = await app.container.make(ProductIndexService)
    await index.sync([product.id])

    const document = handle.engine.upserted[0][0]
    // `price_min` est un décimal sérialisé en chaîne → émis en nombre.
    assert.strictEqual(document.priceMin, 3.5)
    assert.strictEqual(document.moq, 150)
  })

  test('prix/MOQ absents → priceMin et moq null', async ({ client, assert }) => {
    const product = await createProduct(client, 'num-doc-null')
    handle.engine.upserted = []

    const index = await app.container.make(ProductIndexService)
    await index.sync([product.id])

    const document = handle.engine.upserted[0][0]
    assert.isNull(document.priceMin)
    assert.isNull(document.moq)
  })
})

test.group('Facettes numériques — filtre moteur (transmission)', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine(true)
    return () => handle.restore()
  })

  test('les tranches prix/MOQ/EAV cochées sont transmises au moteur en intervalles', async ({
    client,
    assert,
  }) => {
    await client
      .get('/fr/products')
      .qs({
        search: 'crayon',
        // Index 2 de PRICE_BUCKETS = 2–5 € ; index 1 de MOQ_BUCKETS = 50–100.
        priceBuckets: '2',
        moqBuckets: '1',
        attributeRanges: 'cap-weight:400:600',
      })
      .withInertia()

    const request = handle.engine.requests.at(-1)
    assert.deepEqual(request?.filter.priceRanges, [{ min: 2, max: 5 }])
    assert.deepEqual(request?.filter.moqRanges, [{ min: 50, max: 100 }])
    assert.deepEqual(request?.filter.attributeRanges, [{ slug: 'cap-weight', min: 400, max: 600 }])
  })

  test('les valeurs invalides sont ignorées (index hors liste, tranche malformée)', async ({
    client,
    assert,
  }) => {
    await client
      .get('/fr/products')
      .qs({
        search: 'crayon',
        priceBuckets: '99', // hors liste
        attributeRanges: ['pasdetranche', 'slug:abc:def'], // malformées
      })
      .withInertia()

    const request = handle.engine.requests.at(-1)
    assert.deepEqual(request?.filter.priceRanges, [])
    assert.deepEqual(request?.filter.attributeRanges, [])
  })
})

test.group('Facettes numériques — repli PostgreSQL', (group) => {
  useDatabase(group, { seed: 'full' })

  test('une tranche de prix ne renvoie que les produits du bucket, bornes [min, max[', async ({
    client,
    assert,
  }) => {
    await createProduct(client, 'prix-150', { priceMin: 1.5 }) // bucket 1 (1–2 €)
    await createProduct(client, 'prix-200', { priceMin: 2 }) // bucket 2 (2–5 €), borne haute du 1 exclue
    await createProduct(client, 'prix-800', { priceMin: 8 }) // bucket 3

    const slugs = await catalogueSlugs(client, { priceBuckets: '1' })

    assert.include(slugs, 'prix-150')
    assert.notInclude(slugs, 'prix-200') // 2 € n'appartient pas à [1, 2[
    assert.notInclude(slugs, 'prix-800')
  })

  test('plusieurs tranches de prix se combinent en OU', async ({ client, assert }) => {
    await createProduct(client, 'prix-ou-sous1', { priceMin: 0.5 }) // bucket 0 (< 1)
    await createProduct(client, 'prix-ou-3', { priceMin: 3 }) // bucket 2 (2–5)
    await createProduct(client, 'prix-ou-15', { priceMin: 15 }) // bucket 4 (10–25)

    const slugs = await catalogueSlugs(client, { priceBuckets: ['0', '2'] })

    assert.include(slugs, 'prix-ou-sous1')
    assert.include(slugs, 'prix-ou-3')
    assert.notInclude(slugs, 'prix-ou-15')
  })

  test('une tranche de MOQ filtre sur min_quantity', async ({ client, assert }) => {
    await createProduct(client, 'moq-75', { minQuantity: 75 }) // bucket 1 (50–100)
    await createProduct(client, 'moq-300', { minQuantity: 300 }) // bucket 3 (250–500)

    const slugs = await catalogueSlugs(client, { moqBuckets: '1' })

    assert.include(slugs, 'moq-75')
    assert.notInclude(slugs, 'moq-300')
  })

  test('une tranche d’attribut EAV filtre sur value_number, bornes [min, max[', async ({
    client,
    assert,
  }) => {
    const capWeight = await Attribute.findByOrFail('slug', 'cap-weight')
    const inside = await createProduct(client, 'eav-500')
    const atBound = await createProduct(client, 'eav-600')
    const outside = await createProduct(client, 'eav-900')
    await ProductAttribute.create({
      productId: inside.id,
      attributeId: capWeight.id,
      attributeValueId: null,
      valueNumber: '500',
    })
    await ProductAttribute.create({
      productId: atBound.id,
      attributeId: capWeight.id,
      attributeValueId: null,
      valueNumber: '600', // borne haute exclue
    })
    await ProductAttribute.create({
      productId: outside.id,
      attributeId: capWeight.id,
      attributeValueId: null,
      valueNumber: '900',
    })

    const slugs = await catalogueSlugs(client, { attributeRanges: 'cap-weight:400:600' })

    assert.include(slugs, 'eav-500')
    assert.notInclude(slugs, 'eav-600') // 600 ∉ [400, 600[
    assert.notInclude(slugs, 'eav-900')
  })
})
