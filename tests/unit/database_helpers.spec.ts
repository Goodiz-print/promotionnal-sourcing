import { test } from '@japa/runner'
import {
  createIndexConcurrentlySql,
  dropIndexConcurrentlySql,
  isUniqueViolation,
  isUniqueViolationOn,
  violatedConstraint,
  retryOnceOnUniqueViolation,
} from '#shared/helpers/database'

/** Fonction qui renvoie successivement les issues données (erreur levée ou valeur). */
function sequence(outcomes: Array<Error | string>) {
  const calls = { count: 0 }
  const run = async () => {
    const outcome = outcomes[calls.count]
    calls.count += 1
    if (outcome instanceof Error) throw outcome
    return outcome
  }
  return { run, calls }
}

const SLUG = 'products_slug_unique'
const uniqueViolation = (constraint = SLUG) =>
  Object.assign(new Error('duplicate'), { code: '23505', constraint })

test.group('retryOnceOnUniqueViolation', () => {
  test('renvoie le résultat sans nouvel essai si tout va bien', async ({ assert }) => {
    const { run, calls } = sequence(['ok'])
    assert.equal(await retryOnceOnUniqueViolation(run, [SLUG]), 'ok')
    assert.equal(calls.count, 1)
  })

  test('rejoue une fois après une violation d’unicité', async ({ assert }) => {
    const { run, calls } = sequence([uniqueViolation(), 'ok'])
    assert.equal(await retryOnceOnUniqueViolation(run, [SLUG]), 'ok')
    assert.equal(calls.count, 2)
  })

  test('signale la première violation avant le nouvel essai', async ({ assert }) => {
    const first = uniqueViolation()
    const { run } = sequence([first, 'ok'])
    const seen: unknown[] = []
    await retryOnceOnUniqueViolation(run, [SLUG], (error) => seen.push(error))
    assert.deepEqual(seen, [first])
  })

  test('aucun signalement sans nouvel essai', async ({ assert }) => {
    const { run } = sequence([uniqueViolation('other'), 'ok'])
    const seen: unknown[] = []
    await assert.rejects(() => retryOnceOnUniqueViolation(run, [SLUG], (e) => seen.push(e)))
    assert.deepEqual(seen, [])
  })

  test('propage un second échec sans troisième essai', async ({ assert }) => {
    const { run, calls } = sequence([uniqueViolation(), uniqueViolation(), 'ok'])
    await assert.rejects(() => retryOnceOnUniqueViolation(run, [SLUG]), 'duplicate')
    assert.equal(calls.count, 2)
  })

  test('propage une violation d’une autre contrainte sans nouvel essai', async ({ assert }) => {
    const { run, calls } = sequence([
      uniqueViolation('product_variants_product_id_sku_unique'),
      'ok',
    ])
    await assert.rejects(() => retryOnceOnUniqueViolation(run, [SLUG]), 'duplicate')
    assert.equal(calls.count, 1)
  })

  test('propage les autres erreurs sans nouvel essai', async ({ assert }) => {
    const { run, calls } = sequence([new Error('fk'), 'ok'])
    await assert.rejects(() => retryOnceOnUniqueViolation(run, [SLUG]), 'fk')
    assert.equal(calls.count, 1)
  })
})

test.group('isUniqueViolation', () => {
  test('reconnaît le SQLSTATE 23505', ({ assert }) => {
    assert.isTrue(isUniqueViolation(Object.assign(new Error('duplicate'), { code: '23505' })))
  })

  test('ignore les autres erreurs et les valeurs qui ne sont pas des erreurs', ({ assert }) => {
    assert.isFalse(isUniqueViolation(Object.assign(new Error('fk'), { code: '23503' })))
    assert.isFalse(isUniqueViolation(new Error('sans code')))
    assert.isFalse(isUniqueViolation(null))
    assert.isFalse(isUniqueViolation('23505'))
  })
})

test.group('isUniqueViolationOn', () => {
  test('violation d’unicité sur une contrainte attendue', ({ assert }) => {
    assert.isTrue(isUniqueViolationOn(uniqueViolation(), [SLUG, 'other']))
  })

  test('autre contrainte, contrainte absente ou autre erreur : faux', ({ assert }) => {
    assert.isFalse(isUniqueViolationOn(uniqueViolation('other'), [SLUG]))
    assert.isFalse(
      isUniqueViolationOn(Object.assign(new Error('duplicate'), { code: '23505' }), [SLUG])
    )
    assert.isFalse(
      isUniqueViolationOn(Object.assign(new Error('fk'), { code: '23503', constraint: SLUG }), [
        SLUG,
      ])
    )
  })
})

test.group('violatedConstraint', () => {
  test('nom de la contrainte, ou null', ({ assert }) => {
    assert.equal(violatedConstraint(uniqueViolation()), SLUG)
    assert.isNull(violatedConstraint(new Error('fk')))
    assert.isNull(violatedConstraint('23505'))
    assert.isNull(violatedConstraint(null))
  })
})

test.group('createIndexConcurrentlySql', () => {
  test('index unique partiel, rejouable', ({ assert }) => {
    const sql = createIndexConcurrentlySql({
      name: 'notifications_user_type_message_unique',
      table: 'notifications',
      columns: `user_id, type, (data->>'messageId')`,
      where: `(data->>'messageId') IS NOT NULL`,
      unique: true,
    })

    assert.equal(
      sql,
      `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_type_message_unique ON notifications (user_id, type, (data->>'messageId')) WHERE (data->>'messageId') IS NOT NULL`
    )
  })

  test('index simple, sans prédicat', ({ assert }) => {
    const sql = createIndexConcurrentlySql({ name: 'idx', table: 't', columns: 'a' })

    assert.equal(sql, 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx ON t (a)')
  })
})

test.group('dropIndexConcurrentlySql', () => {
  test('retire l’index sans bloquer la table', ({ assert }) => {
    assert.equal(dropIndexConcurrentlySql('idx'), 'DROP INDEX CONCURRENTLY IF EXISTS idx')
  })
})
