import { test } from '@japa/runner'
import { asNode } from '#services/supplier_feed/feed_tree'
import {
  groupBy,
  indexBy,
  isPresent,
  lengthToMm,
  lowestByKey,
  nextTierStart,
  sortedPriceTiers,
  stockStatusFromQuantity,
  stripHtml,
  sumByKey,
  weightToGrams,
} from '#shared/helpers/supplier_feed'

test.group('Flux fournisseurs — utilitaires communs', () => {
  test('stripHtml retire les balises, null si rien ne reste', ({ assert }) => {
    assert.equal(stripHtml('<b>Stylo</b> bille'), 'Stylo bille')
    assert.equal(stripHtml('cm<sup>2</sup>'), 'cm2')
    assert.isNull(stripHtml('<br/>'))
    assert.isNull(stripHtml(null))
  })

  test('lengthToMm : centimètres par défaut, millimètres si annoncés', ({ assert }) => {
    assert.equal(lengthToMm('12,5', 'cm'), 125)
    assert.equal(lengthToMm(12.5, undefined), 125)
    assert.equal(lengthToMm(80, 'MM'), 80)
    assert.isNull(lengthToMm(0, 'cm'))
    assert.isNull(lengthToMm('', 'cm'))
  })

  test('weightToGrams : grammes par défaut, kilogrammes si annoncés', ({ assert }) => {
    assert.equal(weightToGrams(18, 'g'), 18)
    assert.equal(weightToGrams('0,25', 'KG'), 250)
    assert.equal(weightToGrams(18, undefined), 18)
    assert.isNull(weightToGrams(-1, 'g'))
  })

  test('sortedPriceTiers trie et garde le dernier prix d’une quantité', ({ assert }) => {
    assert.deepEqual(
      sortedPriceTiers([
        { minQuantity: 500, unitPrice: 1 },
        { minQuantity: 100, unitPrice: 2 },
        { minQuantity: 500, unitPrice: 0.9 },
      ]),
      [
        { minQuantity: 100, unitPrice: 2 },
        { minQuantity: 500, unitPrice: 0.9 },
      ]
    )
    assert.deepEqual(sortedPriceTiers([]), [])
  })

  test('indexBy écarte les clés et valeurs nulles, la dernière entrée l’emporte', ({ assert }) => {
    const index = indexBy(
      [
        { id: 'a', value: 1 },
        { id: null, value: 2 },
        { id: 'b', value: null },
        { id: 'a', value: 3 },
      ],
      (item) => item.id,
      (item) => item.value
    )
    assert.deepEqual([...index], [['a', 3]])
  })

  test('groupBy regroupe dans l’ordre, sans clés ni valeurs nulles', ({ assert }) => {
    const groups = groupBy(
      [
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
        { id: 'a', value: 3 },
        { id: null, value: 4 },
        { id: 'b', value: null },
      ],
      (item) => item.id,
      (item) => item.value
    )
    assert.deepEqual(
      [...groups],
      [
        ['a', [1, 3]],
        ['b', [2]],
      ]
    )
  })

  test('lowestByKey et sumByKey agrègent par clé', ({ assert }) => {
    const entries = [
      ['a', 5],
      ['b', 2],
      ['a', 3],
    ] as const
    assert.deepEqual(
      [...lowestByKey([...entries])],
      [
        ['a', 3],
        ['b', 2],
      ]
    )
    assert.deepEqual(
      [...sumByKey([...entries])],
      [
        ['a', 8],
        ['b', 2],
      ]
    )
  })

  test('isPresent et asNode : gardes de lecture', ({ assert }) => {
    assert.deepEqual([0, null, '', undefined, false].filter(isPresent), [0, '', false])
    assert.deepEqual(asNode({ a: 1 }), { a: 1 })
    assert.deepEqual(asNode([1]), {})
    assert.deepEqual(asNode('texte'), {})
    assert.deepEqual(asNode(null), {})
  })
})

test.group('Flux fournisseurs — paliers et stock', () => {
  test('nextTierStart : section en mode from, borne précédente + 1 en mode upTo', ({ assert }) => {
    assert.equal(nextTierStart('from', 500, 250), 500)
    assert.equal(nextTierStart('upTo', 500, 250), 251)
  })

  test('stockStatusFromQuantity : inconnu, en stock ou épuisé', ({ assert }) => {
    assert.isNull(stockStatusFromQuantity(null))
    assert.equal(stockStatusFromQuantity(12), 'in_stock')
    assert.equal(stockStatusFromQuantity(0), 'out_of_stock')
    assert.equal(stockStatusFromQuantity(-3), 'out_of_stock')
  })
})
