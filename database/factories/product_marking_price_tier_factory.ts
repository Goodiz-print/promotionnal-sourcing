import factory from '@adonisjs/lucid/factories'
import ProductMarkingPriceTier from '#models/product_marking_price_tier'

/**
 * Palier de la grille de prix de marquage (écart 2). `productId` et
 * `markingTechniqueId` sont à fournir par l'appelant. `unitPrice` reste une
 * chaîne (décimal).
 */
export const ProductMarkingPriceTierFactory = factory
  .define(ProductMarkingPriceTier, ({ faker }) => ({
    minQuantity: faker.helpers.arrayElement([50, 100, 250, 500]),
    unitPrice: faker.number.float({ min: 0.3, max: 2, fractionDigits: 4 }).toString(),
    currency: 'EUR',
  }))
  .build()
