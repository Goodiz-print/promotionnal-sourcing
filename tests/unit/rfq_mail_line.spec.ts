import { test } from '@japa/runner'
import { rfqMailLine } from '#shared/helpers/rfq_mail'
import type { RfqMailItemSource } from '#shared/types/mail'

const ITEM: RfqMailItemSource = {
  name: 'Tote bag',
  description: null,
  quantity: 100,
  unit: null,
  specs: null,
  productReference: 'TB-01',
}

/** Ligne de mail d'un `rfq_item` (#219). */
test.group('rfqMailLine', () => {
  test('lit variante, marquage et prix indicatifs dans les specs du panier', ({ assert }) => {
    const line = rfqMailLine({
      ...ITEM,
      description: '  Logo centré ',
      specs: {
        variant: 'Bleu',
        sku: 'TB-01-BLU',
        markingPosition: 'Face',
        markingTechnique: 'Sérigraphie',
        markingColors: '2',
        estimatedUnitPrice: '2.50 EUR',
        estimatedTotal: '335.00 EUR',
      },
    })

    assert.equal(line.reference, 'TB-01-BLU')
    assert.equal(line.variant, 'Bleu')
    assert.equal(line.note, 'Logo centré')
    assert.deepEqual(line.marking, { position: 'Face', technique: 'Sérigraphie', colors: '2' })
    assert.deepEqual(line.prices, {
      unitPrice: '2.50 EUR',
      markingUnitPrice: null,
      setupCharge: null,
      total: '335.00 EUR',
    })
  })

  test('sans specs : référence du produit, ni marquage ni prix', ({ assert }) => {
    const line = rfqMailLine(ITEM)

    assert.equal(line.reference, 'TB-01')
    assert.isNull(line.variant)
    assert.isNull(line.marking)
    assert.isNull(line.prices)
    assert.isNull(line.note)
  })

  test('un prix sans marquage garde le marquage à null', ({ assert }) => {
    const line = rfqMailLine({ ...ITEM, specs: { estimatedUnitPrice: '1.00 EUR' } })

    assert.isNull(line.marking)
    assert.equal(line.prices?.unitPrice, '1.00 EUR')
  })
})
