import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { useDatabase } from '#tests/utils/setup'
import { CONTENT_LOCALES, LOCALE_TSCONFIG } from '#shared/types/i18n'

test.group('Catalogue — full-text par langue', (group) => {
  useDatabase(group, { seed: 'full', perTest: false })

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

  test('aucune traduction sans search_vector (garde anti-désynchronisation)', async ({
    assert,
  }) => {
    const result = await db.rawQuery(
      `SELECT count(*)::int AS missing FROM product_translations WHERE search_vector IS NULL`
    )
    assert.equal((result.rows as Array<{ missing: number }>)[0].missing, 0)
  })

  test('le produit est trouvé dans chaque langue de contenu active', async ({ assert }) => {
    for (const locale of CONTENT_LOCALES) {
      const result = await db.rawQuery(
        `SELECT count(*)::int AS total FROM product_translations
         WHERE locale = ? AND search_vector @@ websearch_to_tsquery(?::regconfig, ?)`,
        [locale, LOCALE_TSCONFIG[locale], locale === 'fr' ? 'crayon' : 'pencil']
      )
      assert.isAbove((result.rows as Array<{ total: number }>)[0].total, 0, locale)
    }
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
