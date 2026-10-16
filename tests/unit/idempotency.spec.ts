import { test } from '@japa/runner'
import { idempotencyKey, textHash } from '#shared/helpers/idempotency'

test.group('idempotencyKey', () => {
  test('même entrées dans un ordre différent : même clé', ({ assert }) => {
    assert.equal(idempotencyKey({ a: 1, b: ['x', 'y'] }), idempotencyKey({ b: ['x', 'y'], a: 1 }))
  })

  test('une entrée modifiée change la clé', ({ assert }) => {
    assert.notEqual(idempotencyKey({ a: 1 }), idempotencyKey({ a: 2 }))
    assert.notEqual(idempotencyKey({ a: 'x' }), idempotencyKey({ a: 'y' }))
  })

  test('textHash est un sha256 hexadécimal stable', ({ assert }) => {
    assert.match(textHash('crayon'), /^[0-9a-f]{64}$/)
    assert.equal(textHash('crayon'), textHash('crayon'))
  })
})
