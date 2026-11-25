import { test } from '@japa/runner'
import Product from '#models/product'
import ProductTranslation from '#models/product_translation'
import AttributeValue from '#models/attribute_value'
import ProductTransformer from '#transformers/product_transformer'
import AttributeValueTransformer from '#transformers/attribute_value_transformer'
import ProductPriceTier from '#models/product_price_tier'
import ProductSeeder from '#database/seeders/product_seeder'
import db from '@adonisjs/lucid/services/db'
import { useDatabase } from '#tests/utils/setup'

test.group('Catalogue — contenu multilingue', (group) => {
  // truncate() : migration:run (idempotent) au setup + vidage des tables au
  // teardown (le schéma est conservé entre les groupes). On sème via
  // MainSeeder (ordre des dépendances) plutôt que `db:seed` qui exécuterait
  // aussi chaque seeder isolément (dev_user avant les rôles => échec).
  useDatabase(group, { seed: 'full', perTest: false })

  test('le seed crée 7 produits, chacun traduit en fr et en', async ({ assert }) => {
    assert.lengthOf(await Product.all(), 7)
    assert.lengthOf(await ProductTranslation.all(), 14)
  })

  test('ProductTransformer résout le nom dans la locale demandée', async ({ assert }) => {
    const product = await Product.query()
      .where('slug', 'crayon-aquarelle-bleu')
      .preload('translations')
      .firstOrFail()

    const en = new ProductTransformer(product, 'en').toObject()
    const fr = new ProductTransformer(product, 'fr').toObject()

    assert.equal(en.name, 'Blue Watercolor Pencil')
    assert.equal(fr.name, 'Crayon Aquarelle Bleu')
  })

  test('AttributeValueTransformer résout le libellé de facette (Blue / Bleu)', async ({
    assert,
  }) => {
    const value = await AttributeValue.query()
      .where('value', 'blue')
      .preload('translations')
      .firstOrFail()

    const en = new AttributeValueTransformer(value, 'en').toObject()
    const fr = new AttributeValueTransformer(value, 'fr').toObject()

    assert.equal(en.label, 'Blue')
    assert.equal(fr.label, 'Bleu')
  })

  test('filtrage ET : catégorie=crayon ET couleur=blue → uniquement les 2 crayons bleus', async ({
    assert,
  }) => {
    const rows = await Product.query()
      .whereHas('category', (q) => q.where('slug', 'crayon'))
      .whereHas('attributeValues', (q) => q.where('value', 'blue'))
      .orderBy('slug')

    const slugs = rows.map((p) => p.slug)

    assert.deepEqual(slugs, ['crayon-aquarelle-bleu', 'crayon-hb-bleu'])
    assert.notInclude(slugs, 'crayon-hb-rouge')
    assert.notInclude(slugs, 'stylo-bille-bleu')
  })
})

test.group('Catalogue — colonnes de recherche PostgreSQL retirées (#112)', (group) => {
  useDatabase(group, { seed: 'none' })

  test('plus de vecteur, de clé d’embedding ni de tsvector en base', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE (table_name = 'products' AND column_name IN ('embedding', 'embedding_key'))
          OR (table_name = 'product_translations' AND column_name = 'search_vector')`
    )

    assert.deepEqual(result.rows, [])
  })

  test('plus d’index HNSW ni GIN de recherche', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT indexname FROM pg_indexes
       WHERE indexname = 'products_embedding_idx' OR indexname LIKE 'product_translations_search_vector%'`
    )

    assert.deepEqual(result.rows, [])
  })
})

test.group('Catalogue — prix de démo (#293)', (group) => {
  useDatabase(group, { seed: 'full' })

  const tiersOf = async (slug: string) => {
    const product = await Product.findByOrFail('slug', slug)
    return ProductPriceTier.query()
      .where('productId', product.id)
      .orderBy('minQuantity')
      .select('minQuantity', 'unitPrice', 'currency', 'variantId')
  }

  test('une partie des produits a une grille de prix dégressive', async ({ assert }) => {
    const tiers = await tiersOf('crayon-hb-bleu')

    assert.deepEqual(
      tiers.map((tier) => [tier.minQuantity, Number(tier.unitPrice), tier.currency]),
      [
        [100, 0.9, 'EUR'],
        [500, 0.6, 'EUR'],
        [1000, 0.45, 'EUR'],
        [5000, 0.35, 'EUR'],
      ]
    )
    assert.isTrue(tiers.every((tier) => tier.variantId === null))
  })

  test('des produits restent volontairement sans prix', async ({ assert }) => {
    assert.lengthOf(await tiersOf('crayon-hb-rouge'), 0)
    assert.lengthOf(await tiersOf('stylo-bille-noir'), 0)
  })

  test('priceMin / priceMax du seed sont les bornes de la grille', async ({ assert }) => {
    const ranges = await db
      .from('product_price_tiers')
      .join('products', 'products.id', 'product_price_tiers.product_id')
      .whereNull('product_price_tiers.variant_id')
      .groupBy('products.slug', 'products.price_min', 'products.price_max')
      .select('products.slug', 'products.price_min', 'products.price_max')
      .min('product_price_tiers.unit_price as tier_min')
      .max('product_price_tiers.unit_price as tier_max')

    assert.lengthOf(ranges, 5)
    ranges.forEach((range) => {
      assert.equal(Number(range.price_min), Number(range.tier_min), range.slug)
      assert.equal(Number(range.price_max), Number(range.tier_max), range.slug)
    })
  })

  test('rejouer le seed ne duplique pas les paliers', async ({ assert }) => {
    await new ProductSeeder(db.connection()).run()

    assert.lengthOf(await tiersOf('crayon-hb-bleu'), 4)
    assert.lengthOf(await tiersOf('casquette-6-panneaux-marine'), 3)
  })

  test('rejouer le seed retire une grille absente du seed', async ({ assert }) => {
    const product = await Product.findByOrFail('slug', 'crayon-hb-rouge')
    await ProductPriceTier.create({
      productId: product.id,
      variantId: null,
      minQuantity: 100,
      unitPrice: '1.00',
      currency: 'EUR',
    })

    await new ProductSeeder(db.connection()).run()

    assert.lengthOf(await tiersOf('crayon-hb-rouge'), 0)
  })
})
