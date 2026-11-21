import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { createIndexConcurrently, isInvalidIndex } from '#database/concurrent_index'
import { isUniqueViolation } from '#shared/helpers/database'

const TABLE = 'concurrent_index_probe'
const INDEX = {
  name: 'concurrent_index_probe_code_unique',
  table: TABLE,
  columns: 'code',
  unique: true,
}

/**
 * `createIndexConcurrently` (migrations 035 et 036, #225). Pas de
 * `useDatabase` : `CREATE INDEX CONCURRENTLY` est interdit dans une
 * transaction, le groupe travaille donc sur sa propre table, créée et retirée.
 */
test.group('createIndexConcurrently', (group) => {
  group.each.setup(async () => {
    await db.rawQuery(`DROP TABLE IF EXISTS ${TABLE}`)
    await db.rawQuery(`CREATE TABLE ${TABLE} (id serial PRIMARY KEY, code text)`)
    return () => db.rawQuery(`DROP TABLE IF EXISTS ${TABLE}`)
  })

  test('construit un index valide, qui fait respecter l’unicité', async ({ assert }) => {
    await createIndexConcurrently(db.connection(), INDEX)

    assert.isFalse(await isInvalidIndex(db.connection(), INDEX.name))
    await db.table(TABLE).insert({ code: 'A' })
    const error = await db
      .table(TABLE)
      .insert({ code: 'A' })
      .catch((err: unknown) => err)
    assert.isTrue(isUniqueViolation(error))
  })

  test('après un échec, retire l’index invalide et le reconstruit', async ({ assert }) => {
    await db.table(TABLE).multiInsert([{ code: 'A' }, { code: 'A' }])
    await assert.rejects(() => createIndexConcurrently(db.connection(), INDEX))
    assert.isTrue(await isInvalidIndex(db.connection(), INDEX.name))

    await db.rawQuery(`DELETE FROM ${TABLE} WHERE id = (SELECT max(id) FROM ${TABLE})`)
    await createIndexConcurrently(db.connection(), INDEX)

    assert.isFalse(await isInvalidIndex(db.connection(), INDEX.name))
  })

  test('un index absent n’est pas invalide', async ({ assert }) => {
    assert.isFalse(await isInvalidIndex(db.connection(), 'concurrent_index_probe_missing'))
  })
})
