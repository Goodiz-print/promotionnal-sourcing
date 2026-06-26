import { test } from '@japa/runner'

test.group('Example unit tests', () => {
  test('basic arithmetic works', ({ assert }) => {
    assert.equal(2 + 2, 4)
  })

  test('string concatenation works', ({ assert }) => {
    const greeting = 'Hello' + ' ' + 'World'
    assert.equal(greeting, 'Hello World')
  })

  test('array includes element', ({ assert }) => {
    const numbers = [1, 2, 3, 4, 5]
    assert.isTrue(numbers.includes(3))
    assert.isFalse(numbers.includes(10))
  })
})
