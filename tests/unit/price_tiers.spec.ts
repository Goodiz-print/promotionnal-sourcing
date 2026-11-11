import { test } from '@japa/runner'
import {
  applicableTier,
  estimateLine,
  fromUnits,
  nextTier,
  sumEstimates,
  tiersForVariant,
  toUnits,
} from '#shared/helpers/price_tiers'

/**
 * Grilles dégressives et estimation d'une ligne du panier de devis : palier
 * atteint (seuils inclus), grille de variante prioritaire, marquage et frais
 * techniques, devises, arrondis au centime.
 */
const grid = [
  { minQuantity: 500, unitPrice: '1.6000', currency: 'EUR' },
  { minQuantity: 100, unitPrice: '2.1000', currency: 'EUR' },
  { minQuantity: 250, unitPrice: '1.8500', currency: 'EUR' },
]

test.group('price_tiers — paliers', () => {
  test('retient le seuil le plus haut atteint, seuil inclus', ({ assert }) => {
    assert.equal(applicableTier(grid, 100)?.unitPrice, '2.1000')
    assert.equal(applicableTier(grid, 249)?.unitPrice, '2.1000')
    assert.equal(applicableTier(grid, 250)?.unitPrice, '1.8500')
    assert.equal(applicableTier(grid, 10_000)?.unitPrice, '1.6000')
  })

  test('aucun palier sous le premier seuil', ({ assert }) => {
    assert.isNull(applicableTier(grid, 99))
    assert.isNull(applicableTier([], 1000))
  })

  test('palier suivant strictement au-dessus de la quantité', ({ assert }) => {
    assert.equal(nextTier(grid, 99)?.minQuantity, 100)
    assert.equal(nextTier(grid, 250)?.minQuantity, 500)
    assert.isNull(nextTier(grid, 500))
  })

  test('saute les seuils au même prix : seul un palier moins cher est annoncé', ({ assert }) => {
    const flat = [
      { minQuantity: 1, unitPrice: '3.3800', currency: 'EUR' },
      { minQuantity: 100, unitPrice: '3.3800', currency: 'EUR' },
      { minQuantity: 250, unitPrice: '3.3800', currency: 'EUR' },
      { minQuantity: 1000, unitPrice: '3.3400', currency: 'EUR' },
    ]
    assert.equal(nextTier(flat, 1)?.minQuantity, 1000)
    assert.isNull(nextTier(flat.slice(0, 3), 1))
  })

  test('grille de la variante si elle en a une, sinon celle du produit', ({ assert }) => {
    const tiers = [
      { variantId: null, minQuantity: 1, unitPrice: '2.00', currency: 'EUR' },
      { variantId: 7, minQuantity: 1, unitPrice: '2.50', currency: 'EUR' },
    ]
    assert.deepEqual(
      tiersForVariant(tiers, 7).map((tier) => tier.unitPrice),
      ['2.50']
    )
    assert.deepEqual(
      tiersForVariant(tiers, 8).map((tier) => tier.unitPrice),
      ['2.00']
    )
    assert.deepEqual(
      tiersForVariant(tiers, null).map((tier) => tier.unitPrice),
      ['2.00']
    )
  })
})

test.group('price_tiers — décimaux', () => {
  test('conversion exacte en dix-millièmes', ({ assert }) => {
    assert.equal(toUnits('1.85'), 18_500n)
    assert.equal(toUnits('1.8525'), 18_525n)
    assert.equal(toUnits('12'), 120_000n)
    assert.isNull(toUnits('abc'))
    assert.equal(fromUnits(18_500n), '1.85')
    assert.equal(fromUnits(18_525n), '1.8525')
    assert.equal(fromUnits(120_000n), '12.00')
    assert.equal(fromUnits(18_000n), '1.80')
  })
})

test.group('price_tiers — estimateLine', () => {
  test('total = quantité × prix du palier atteint, palier suivant annoncé', ({ assert }) => {
    const estimate = estimateLine({
      productTiers: grid,
      markingTiers: [],
      withMarking: false,
      setupCharge: null,
      quantity: 300,
    })
    assert.deepEqual(estimate, {
      currency: 'EUR',
      unitPrice: '1.85',
      markingUnitPrice: null,
      setupCharge: null,
      total: '555.00',
      partial: false,
      belowFirstTier: false,
      nextTier: { minQuantity: 500, unitPrice: '1.60', currency: 'EUR' },
    })
  })

  test('ajoute le marquage dégressif et les frais techniques', ({ assert }) => {
    const estimate = estimateLine({
      productTiers: grid,
      markingTiers: [
        { minQuantity: 1, unitPrice: '0.40', currency: 'EUR' },
        { minQuantity: 250, unitPrice: '0.30', currency: 'EUR' },
      ],
      withMarking: true,
      setupCharge: '45.00',
      quantity: 250,
    })
    // 250 × (1.85 + 0.30) + 45
    assert.equal(estimate?.markingUnitPrice, '0.30')
    assert.equal(estimate?.setupCharge, '45.00')
    assert.equal(estimate?.total, '582.50')
    assert.isFalse(estimate?.partial)
  })

  test('marquage sans prix connu (ou dans une autre devise) : total partiel', ({ assert }) => {
    const estimate = estimateLine({
      productTiers: grid,
      markingTiers: [{ minQuantity: 1, unitPrice: '0.40', currency: 'USD' }],
      withMarking: true,
      setupCharge: null,
      quantity: 100,
    })
    assert.isNull(estimate?.markingUnitPrice)
    assert.equal(estimate?.total, '210.00')
    assert.isTrue(estimate?.partial)
  })

  test('sous le premier seuil : pas de total, premier palier annoncé', ({ assert }) => {
    const estimate = estimateLine({
      productTiers: grid,
      markingTiers: [],
      withMarking: false,
      setupCharge: null,
      quantity: 50,
    })
    assert.isNull(estimate?.unitPrice)
    assert.isNull(estimate?.total)
    assert.isTrue(estimate?.belowFirstTier)
    assert.equal(estimate?.nextTier?.minQuantity, 100)
  })

  test('sans grille : prix sur devis', ({ assert }) => {
    assert.isNull(
      estimateLine({
        productTiers: [],
        markingTiers: [],
        withMarking: false,
        setupCharge: null,
        quantity: 100,
      })
    )
  })

  test('arrondi au centime, demi vers le haut, sans erreur flottante', ({ assert }) => {
    const estimate = estimateLine({
      productTiers: [{ minQuantity: 1, unitPrice: '0.1235', currency: 'EUR' }],
      markingTiers: [],
      withMarking: false,
      setupCharge: null,
      quantity: 10,
    })
    // 10 × 0.1235 = 1.235 → 1.24
    assert.equal(estimate?.total, '1.24')
    assert.equal(estimate?.unitPrice, '0.1235')
  })

  test('grosses quantités sans dépassement', ({ assert }) => {
    const estimate = estimateLine({
      productTiers: [{ minQuantity: 1, unitPrice: '99999999.9999', currency: 'EUR' }],
      markingTiers: [],
      withMarking: false,
      setupCharge: null,
      quantity: 10_000_000,
    })
    // (1e8 − 0.0001) × 1e7 = 1e15 − 1000
    assert.equal(estimate?.total, '999999999999000.00')
  })
})

test.group('price_tiers — sumEstimates', () => {
  const line = (total: string | null, currency = 'EUR', partial = false) => ({
    currency,
    unitPrice: null,
    markingUnitPrice: null,
    setupCharge: null,
    total,
    partial,
    belowFirstTier: false,
    nextTier: null,
  })

  test('un sous-total par devise', ({ assert }) => {
    const { subtotals, complete } = sumEstimates([line('10.50'), line('4.25'), line('3.00', 'USD')])
    assert.deepEqual(subtotals, [
      { currency: 'EUR', total: '14.75' },
      { currency: 'USD', total: '3.00' },
    ])
    assert.isTrue(complete)
  })

  test('incomplet dès une ligne sur devis, sans total ou partielle', ({ assert }) => {
    assert.isFalse(sumEstimates([line('1.00'), null]).complete)
    assert.isFalse(sumEstimates([line('1.00'), line(null)]).complete)
    assert.isFalse(sumEstimates([line('1.00', 'EUR', true)]).complete)
  })
})
