import factory from '@adonisjs/lucid/factories'
import RfqItem from '#models/rfq_item'

/**
 * Ligne de besoin libre (ni produit ni catégorie du catalogue). `rfqId` reste à
 * fournir par l'appelant.
 */
export const RfqItemFactory = factory
  .define(RfqItem, async ({ faker }) => ({
    name: faker.commerce.productName(),
    quantity: faker.number.int({ min: 50, max: 1000 }),
  }))
  .build()
