import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import Category from '#models/category'
import Product from '#models/product'
import ProductVariant from '#models/product_variant'
import ProductIndexService from '#services/product_index_service'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'
import { seededDevUser } from '#tests/utils/organizations'
import type { ProductVariantInput } from '#shared/types/product'

/**
 * Stock par variante (plan L98) : agrégation au niveau produit (facette
 * « Stock », priorité au disponible), colonne dérivée persistée recalée à
 * l'indexation, et saisie fournisseur bout en bout.
 */

/** Crée un produit fournisseur via l'endpoint, avec ses variantes. */
async function createProduct(
  client: ApiClient,
  slug: string,
  variants: ProductVariantInput[]
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
      variants,
    })
  response.assertStatus(200)

  return Product.query().where('slug', slug).preload('variants').firstOrFail()
}

async function catalogueSlugs(client: ApiClient, qs: Record<string, unknown>): Promise<string[]> {
  const response = await client.get('/fr/products').qs(qs).withInertia()
  return response.inertiaProps.products.data.map((p: { slug: string }) => p.slug)
}

test.group('Stock — indexation (agrégation au niveau produit)', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine(true)
    return () => handle.restore()
  })

  async function indexService() {
    return app.container.make(ProductIndexService)
  }

  test('le document porte le statut agrégé (priorité au disponible) et persiste la colonne', async ({
    client,
    assert,
  }) => {
    const product = await createProduct(client, 'stock-mix', [
      { sku: 'S-EPUISE', stockStatus: 'out_of_stock' },
      { sku: 'S-COMMANDE', stockStatus: 'on_order' },
      { sku: 'S-DISPO', stockStatus: 'in_stock' },
    ])
    handle.engine.upserted = []

    const index = await indexService()
    await index.sync([product.id])

    // Priorité au disponible : in_stock gagne sur on_order et out_of_stock.
    assert.equal(handle.engine.upserted[0][0].stockStatus, 'in_stock')
    // Colonne dérivée persistée (backfill).
    await product.refresh()
    assert.equal(product.stockStatus, 'in_stock')
  })

  test('les variantes inactives sont ignorées dans l’agrégation', async ({ client, assert }) => {
    const product = await createProduct(client, 'stock-inactive', [
      { sku: 'S-DISPO-OFF', stockStatus: 'in_stock', isActive: false },
      { sku: 'S-COMMANDE-ON', stockStatus: 'on_order' },
    ])
    handle.engine.upserted = []

    const index = await indexService()
    await index.sync([product.id])

    // La seule variante disponible est inactive → on_order l'emporte.
    assert.equal(handle.engine.upserted[0][0].stockStatus, 'on_order')
  })

  test('aucune variante active avec statut → stockStatus null', async ({ client, assert }) => {
    const product = await createProduct(client, 'stock-inconnu', [
      { sku: 'S-SANS-1' },
      { sku: 'S-SANS-2' },
    ])
    handle.engine.upserted = []

    const index = await indexService()
    await index.sync([product.id])

    assert.isNull(handle.engine.upserted[0][0].stockStatus)
    await product.refresh()
    assert.isNull(product.stockStatus)
  })

  test('le filtre de stock est transmis au moteur', async ({ client, assert }) => {
    const product = await createProduct(client, 'stock-moteur', [
      { sku: 'SM-1', stockStatus: 'in_stock' },
    ])
    const index = await indexService()
    await index.sync([product.id])

    await client
      .get('/fr/products')
      .qs({ search: 'stock-moteur', stockStatuses: ['in_stock', 'on_order'] })
      .withInertia()

    const request = handle.engine.requests.at(-1)
    assert.deepEqual(request?.filter.stockStatuses, ['in_stock', 'on_order'])
  })
})

test.group('Stock — filtre catalogue (repli PostgreSQL)', (group) => {
  useDatabase(group, { seed: 'full' })

  /** Crée un produit et force son statut agrégé persisté (comme après indexation). */
  async function withStatus(
    client: ApiClient,
    slug: string,
    status: 'in_stock' | 'out_of_stock' | 'on_order'
  ): Promise<void> {
    const product = await createProduct(client, slug, [{ sku: `${slug}-v`, stockStatus: status }])
    await product.merge({ stockStatus: status }).save()
  }

  test('un statut ne renvoie que les produits agrégés sur ce statut', async ({
    client,
    assert,
  }) => {
    await withStatus(client, 'dispo', 'in_stock')
    await withStatus(client, 'epuise', 'out_of_stock')

    const slugs = await catalogueSlugs(client, { stockStatuses: 'in_stock' })

    assert.include(slugs, 'dispo')
    assert.notInclude(slugs, 'epuise')
  })

  test('plusieurs statuts se combinent en OU', async ({ client, assert }) => {
    await withStatus(client, 'dispo-ou', 'in_stock')
    await withStatus(client, 'commande-ou', 'on_order')
    await withStatus(client, 'epuise-ou', 'out_of_stock')

    const slugs = await catalogueSlugs(client, { stockStatuses: ['in_stock', 'on_order'] })

    assert.include(slugs, 'dispo-ou')
    assert.include(slugs, 'commande-ou')
    assert.notInclude(slugs, 'epuise-ou')
  })
})

test.group('Stock — saisie fournisseur (round-trip)', (group) => {
  useDatabase(group, { seed: 'full' })

  test('la création enregistre quantité et statut par variante', async ({ client, assert }) => {
    const product = await createProduct(client, 'stock-saisie', [
      { sku: 'SV-DISPO', stockQuantity: 120, stockStatus: 'in_stock' },
      { sku: 'SV-SANS' },
    ])

    const dispo = product.variants.find((v) => v.sku === 'SV-DISPO')!
    const sans = product.variants.find((v) => v.sku === 'SV-SANS')!
    assert.equal(dispo.stockQuantity, 120)
    assert.equal(dispo.stockStatus, 'in_stock')
    assert.isNull(sans.stockQuantity)
    assert.isNull(sans.stockStatus)
  })

  test('la mise à jour sans champ stock conserve la valeur (undefined = inchangé)', async ({
    client,
    assert,
  }) => {
    const user = await seededDevUser('eurogoods-org')
    const product = await createProduct(client, 'stock-maj', [
      { sku: 'SU-1', stockQuantity: 50, stockStatus: 'on_order' },
    ])

    await client
      .post(`/fr/supplier/products/${product.id}`)
      .withInertia()
      .withCsrfToken()
      .loginAs(user)
      // SKU repris sans champ stock : la valeur existante est conservée.
      .json({ variants: [{ sku: 'SU-1' }] })
      .then((r) => r.assertStatus(200))

    const variant = await ProductVariant.query()
      .where('productId', product.id)
      .where('sku', 'SU-1')
      .firstOrFail()
    assert.equal(variant.stockQuantity, 50)
    assert.equal(variant.stockStatus, 'on_order')
  })
})
