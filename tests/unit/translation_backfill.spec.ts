import { test } from '@japa/runner'
import {
  emptyBackfillCounts,
  nextBackfillBatchSize,
  selectBackfillEntities,
} from '#shared/helpers/translation_backfill'
import { TRANSLATABLE_ENTITIES } from '#shared/types/ai'

/**
 * Calculs purs du rattrapage des traductions : types retenus, compteurs à zéro,
 * taille du lot suivant sous la limite.
 */
test.group('Rattrapage des traductions — helpers', () => {
  test('selectBackfillEntities : tous les types sans demande', ({ assert }) => {
    assert.deepEqual(selectBackfillEntities(), [...TRANSLATABLE_ENTITIES])
  })

  test("selectBackfillEntities : l'ordre canonique, quel que soit l'ordre demandé", ({
    assert,
  }) => {
    assert.deepEqual(selectBackfillEntities(['category', 'product']), ['product', 'category'])
  })

  test('selectBackfillEntities : aucune demande vide ne retient rien', ({ assert }) => {
    assert.deepEqual(selectBackfillEntities([]), [])
  })

  test('selectBackfillEntities : renvoie une copie, jamais la constante', ({ assert }) => {
    const entities = selectBackfillEntities()
    entities.pop()
    assert.lengthOf(TRANSLATABLE_ENTITIES, entities.length + 1)
  })

  test('emptyBackfillCounts : un compteur à zéro par type', ({ assert }) => {
    assert.deepEqual(emptyBackfillCounts(), {
      product: 0,
      category: 0,
      attribute: 0,
      attribute_value: 0,
      certification: 0,
      marking_technique: 0,
    })
  })

  test('emptyBackfillCounts : un objet neuf à chaque appel', ({ assert }) => {
    const first = emptyBackfillCounts()
    first.product = 3
    assert.equal(emptyBackfillCounts().product, 0)
  })

  test('nextBackfillBatchSize : sans limite, toujours la taille de lot', ({ assert }) => {
    assert.equal(nextBackfillBatchSize(500, 0), 500)
    assert.equal(nextBackfillBatchSize(500, 10_000), 500)
  })

  test('nextBackfillBatchSize : réduit le lot à ce qui reste sous la limite', ({ assert }) => {
    assert.equal(nextBackfillBatchSize(500, 0, 3), 3)
    assert.equal(nextBackfillBatchSize(2, 0, 3), 2)
    assert.equal(nextBackfillBatchSize(2, 2, 3), 1)
  })

  test('nextBackfillBatchSize : jamais négatif, zéro une fois la limite atteinte', ({ assert }) => {
    assert.equal(nextBackfillBatchSize(500, 3, 3), 0)
    assert.equal(nextBackfillBatchSize(500, 5, 3), 0)
    assert.equal(nextBackfillBatchSize(500, 0, 0), 0)
  })
})
