import { test } from '@japa/runner'
import {
  attributeSelectionsToFilters,
  bucketsToRanges,
  rangeContains,
  sumRangeCount,
} from '#shared/helpers/numeric_ranges'
import { MOQ_BUCKETS, PRICE_BUCKETS } from '#shared/types/product'

/**
 * Logique de tranches numériques `[min, max[` (plan L125), factorisée et partagée
 * (comptage, filtrage moteur, repli PostgreSQL). On éprouve les bornes incluses /
 * exclues, la borne `null` ouverte, et la résolution des buckets.
 */
test.group('numeric_ranges — rangeContains ([min, max[)', () => {
  test('borne basse incluse, borne haute exclue', ({ assert }) => {
    assert.isTrue(rangeContains(1, 1, 2)) // min inclus
    assert.isFalse(rangeContains(2, 1, 2)) // max exclu
    assert.isTrue(rangeContains(1.99, 1, 2))
    assert.isFalse(rangeContains(0.99, 1, 2))
  })

  test('une borne null est ouverte', ({ assert }) => {
    assert.isTrue(rangeContains(0.5, null, 1)) // < 1
    assert.isFalse(rangeContains(1, null, 1))
    assert.isTrue(rangeContains(25, 25, null)) // ≥ 25
    assert.isFalse(rangeContains(24.99, 25, null))
    assert.isTrue(rangeContains(123, null, null)) // entièrement ouverte
  })

  test('valeur non finie : hors de toute tranche', ({ assert }) => {
    assert.isFalse(rangeContains(Number.NaN, null, 10))
  })
})

test.group('numeric_ranges — sumRangeCount', () => {
  const distribution = { '0.5': 2, '1': 3, '2': 5, '4.9': 1, '25': 4, 'nan': 7 }

  test('somme les valeurs comprises dans [min, max[, ignore les clés non numériques', ({
    assert,
  }) => {
    // [1, 5[ : 1 (3) + 2 (5) + 4.9 (1) = 9 ; 0.5 exclu (< 1), 25 exclu (≥ 5).
    assert.equal(sumRangeCount(distribution, 1, 5), 9)
    // < 1 : seul 0.5.
    assert.equal(sumRangeCount(distribution, null, 1), 2)
    // ≥ 25 : seul 25.
    assert.equal(sumRangeCount(distribution, 25, null), 4)
    // Aucune valeur dans la tranche.
    assert.equal(sumRangeCount(distribution, 5, 10), 0)
  })
})

test.group('numeric_ranges — conversions de sélection', () => {
  test('bucketsToRanges résout les index valides et ignore les autres', ({ assert }) => {
    // Index 0 (< 1 €) et 2 (2–5 €) de PRICE_BUCKETS ; 99 est hors liste → ignoré.
    assert.deepEqual(bucketsToRanges([0, 2, 99], PRICE_BUCKETS), [
      { min: null, max: 1 },
      { min: 2, max: 5 },
    ])
    // MOQ : dernier bucket ouvert (≥ 1000).
    assert.deepEqual(bucketsToRanges([5], MOQ_BUCKETS), [{ min: 1000, max: null }])
    assert.deepEqual(bucketsToRanges([], PRICE_BUCKETS), [])
  })

  test('attributeSelectionsToFilters mappe slug + bornes', ({ assert }) => {
    assert.deepEqual(
      attributeSelectionsToFilters([{ slug: 'grammage', minValue: 400, maxValue: 600 }]),
      [{ slug: 'grammage', min: 400, max: 600 }]
    )
  })
})
