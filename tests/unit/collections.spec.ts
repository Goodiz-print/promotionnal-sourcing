import { test } from '@japa/runner'
import { compareCodeUnits, toArray } from '#shared/helpers/collections'

test.group('toArray', () => {
  test('garde un tableau tel quel', ({ assert }) => {
    assert.deepEqual(toArray(['1', '2']), ['1', '2'])
  })

  test('enveloppe une valeur unique, même falsy', ({ assert }) => {
    assert.deepEqual(toArray('3'), ['3'])
    assert.deepEqual(toArray(''), [''])
    assert.deepEqual(toArray(null), [null])
  })

  test('renvoie une liste vide si absent', ({ assert }) => {
    assert.deepEqual(toArray(undefined), [])
  })
})

test.group('compareCodeUnits', () => {
  test('renvoie -1, 0 ou 1 selon l’ordre', ({ assert }) => {
    assert.equal(compareCodeUnits('a', 'b'), -1)
    assert.equal(compareCodeUnits('b', 'b'), 0)
    assert.equal(compareCodeUnits('c', 'b'), 1)
  })

  test('trie par code UTF-16, majuscules avant minuscules, sans locale', ({ assert }) => {
    assert.deepEqual(['b', 'B', 'a', 'é'].sort(compareCodeUnits), ['B', 'a', 'b', 'é'])
  })
})
