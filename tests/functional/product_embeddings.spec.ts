import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { isPostgres } from '#tests/utils/database'
import MainSeeder from '#database/seeders/main_seeder'
import Product from '#models/product'
import ProductCatalogueService from '#services/product_catalogue_service'
import { toPgVector } from '#shared/helpers/pgvector'

const DIMS = 1024

/** Vecteur unitaire canonique (un `1` à la position `index`, sinon `0`). */
function unitVector(index: number): number[] {
  const vector = new Array<number>(DIMS).fill(0)
  vector[index] = 1
  return vector
}

async function setEmbedding(slug: string, vector: number[]): Promise<void> {
  const product = await Product.findByOrFail('slug', slug)
  await db.rawQuery('UPDATE products SET embedding = ?::vector WHERE id = ?', [
    toPgVector(vector),
    product.id,
  ])
}

function listOptions(overrides: Partial<Parameters<ProductCatalogueService['list']>[0]>) {
  return {
    search: 'quelque chose',
    categoryId: null,
    madeInEurope: false,
    attributeValueIds: [],
    queryEmbedding: null,
    page: 1,
    perPage: 10,
    locale: 'fr' as const,
    ...overrides,
  }
}

test.group('Recherche sémantique — embeddings produits', (group) => {
  // pgvector (colonne `products.embedding`, opérateur `<=>`) impose PostgreSQL.
  if (isPostgres()) {
    group.each.setup(() => testUtils.db().truncate())
    group.each.setup(() => new MainSeeder(db.connection()).run())
  } else {
    group.tap((t) => t.skip(true, 'Requiert PostgreSQL + pgvector'))
  }

  test('classe les produits vectorisés par proximité cosinus à la requête', async ({ assert }) => {
    await setEmbedding('crayon-hb-bleu', unitVector(0))
    await setEmbedding('crayon-hb-rouge', unitVector(1))

    const service = new ProductCatalogueService()
    const paginator = await service.list(listOptions({ queryEmbedding: unitVector(0) }))

    const slugs = paginator.all().map((product) => product.slug)
    // Seuls les produits vectorisés remontent ; le plus proche (bleu) en tête.
    assert.deepEqual(slugs, ['crayon-hb-bleu', 'crayon-hb-rouge'])
  })

  test('inverser la requête inverse le classement', async ({ assert }) => {
    await setEmbedding('crayon-hb-bleu', unitVector(0))
    await setEmbedding('crayon-hb-rouge', unitVector(1))

    const service = new ProductCatalogueService()
    const paginator = await service.list(listOptions({ queryEmbedding: unitVector(1) }))

    const slugs = paginator.all().map((product) => product.slug)
    assert.deepEqual(slugs, ['crayon-hb-rouge', 'crayon-hb-bleu'])
  })

  test('sans embedding de requête : repli full-text (produits lexicaux)', async ({ assert }) => {
    const service = new ProductCatalogueService()
    const paginator = await service.list(listOptions({ search: 'crayon', queryEmbedding: null }))

    assert.isAbove(paginator.all().length, 0)
  })
})
