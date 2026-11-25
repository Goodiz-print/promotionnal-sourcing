import factory from '@adonisjs/lucid/factories'
import ProductPriceTier from '#models/product_price_tier'

/**
 * Palier de la grille de prix dégressive d'un produit. `productId` est à
 * fournir par l'appelant ; `variantId` null = palier du produit (toutes
 * variantes). `unitPrice` reste une chaîne (décimal).
 */
export const ProductPriceTierFactory = factory
  .define(ProductPriceTier, ({ faker }) => ({
    variantId: null,
    minQuantity: faker.helpers.arrayElement([50, 100, 250, 500]),
    unitPrice: faker.number.float({ min: 0.5, max: 20, fractionDigits: 4 }).toString(),
    currency: 'EUR',
  }))
  .build()
