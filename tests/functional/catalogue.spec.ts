import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { isPostgres } from '#tests/utils/database'
import MainSeeder from '#database/seeders/main_seeder'
import Product from '#models/product'
import ProductTranslation from '#models/product_translation'
import AttributeValue from '#models/attribute_value'
import ProductTransformer from '#transformers/product_transformer'
import AttributeValueTransformer from '#transformers/attribute_value_transformer'

test.group('Catalogue — contenu multilingue', (group) => {
  if (isPostgres()) {
    // truncate() : migration:run (idempotent) au setup + vidage des tables au
    // teardown (le schéma est conservé entre les groupes). On sème via
    // MainSeeder (ordre des dépendances) plutôt que `db:seed` qui exécuterait
    // aussi chaque seeder isolément (dev_user avant les rôles => échec).
    group.setup(() => testUtils.db().truncate())
    group.setup(() => new MainSeeder(db.connection()).run())
  } else {
    group.tap((t) => t.skip(true, 'Catalogue : PostgreSQL requis (pgvector/tsvector)'))
  }

  test('le seed crée 6 produits, chacun traduit en fr et en', async ({ assert }) => {
    assert.lengthOf(await Product.all(), 6)
    assert.lengthOf(await ProductTranslation.all(), 12)
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
