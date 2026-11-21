import { test } from '@japa/runner'
import {
  createIndexConcurrentlySql,
  dropIndexConcurrentlySql,
  isUniqueViolation,
} from '#shared/helpers/database'

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
