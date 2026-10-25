import factory from '@adonisjs/lucid/factories'
import QuoteItem from '#models/quote_item'

/**
 * Ligne de devis. `quoteId` et `rfqItemId` restent à fournir par l'appelant.
 */
export const QuoteItemFactory = factory
  .define(QuoteItem, async ({ faker }) => {
    const unitPrice = faker.number.float({ min: 0.5, max: 20, fractionDigits: 2 })
    const quantity = faker.number.int({ min: 50, max: 1000 })
    return {
      unitPrice: String(unitPrice),
      quantity,
      totalPrice: (unitPrice * quantity).toFixed(2),
      leadTimeDays: faker.number.int({ min: 5, max: 45 }),
    }
  })
  .build()
