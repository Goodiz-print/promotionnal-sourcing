import { test } from '@japa/runner'
import { isUniqueViolation } from '#shared/helpers/database'

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
