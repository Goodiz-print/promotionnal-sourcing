import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { isPostgres } from '#tests/utils/database'
import MainSeeder from '#database/seeders/main_seeder'

test.group('Catalogue — full-text par langue', (group) => {
  if (isPostgres()) {
    group.setup(() => testUtils.db().truncate())
    group.setup(() => new MainSeeder(db.connection()).run())
  } else {
    group.tap((t) => t.skip(true, 'FTS : PostgreSQL requis (tsvector)'))
  }

  test('recherche anglaise (watercolor) → uniquement la ligne EN', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT locale, name FROM product_translations WHERE search_vector @@ to_tsquery('english', ?)`,
      ['watercolor']
    )
    const rows = result.rows as Array<{ locale: string; name: string }>

    assert.lengthOf(rows, 1)
    assert.equal(rows[0].locale, 'en')
    assert.include(rows[0].name, 'Watercolor')
  })

  test('recherche française (aquarelle) → uniquement la ligne FR', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT locale, name FROM product_translations WHERE search_vector @@ to_tsquery('french', ?)`,
      ['aquarelle']
    )
    const rows = result.rows as Array<{ locale: string; name: string }>

    assert.lengthOf(rows, 1)
    assert.equal(rows[0].locale, 'fr')
  })

  test('la recherche anglaise ne matche pas le contenu français', async ({ assert }) => {
    const result = await db.rawQuery(
      `SELECT locale FROM product_translations
       WHERE locale = 'fr' AND search_vector @@ to_tsquery('english', ?)`,
      ['watercolor']
    )

    assert.lengthOf(result.rows as unknown[], 0)
  })

  test('products.embedding présent et NULL (peuplé à un prochain incrément)', async ({
    assert,
  }) => {
    const result = await db.rawQuery(
      `SELECT count(*)::int AS total, count(embedding)::int AS with_embedding FROM products`
    )
    const row = (result.rows as Array<{ total: number; with_embedding: number }>)[0]

    assert.equal(row.total, 6)
    assert.equal(row.with_embedding, 0)
  })
})
