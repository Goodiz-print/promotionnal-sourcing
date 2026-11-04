import factory from '@adonisjs/lucid/factories'
import ProductVariant from '#models/product_variant'

/**
 * Variante produit de test. `productId` est à fournir par l'appelant via
 * `.merge({ productId })`.
 */
export const ProductVariantFactory = factory
  .define(ProductVariant, ({ faker }) => ({
    sku: faker.string.alphanumeric(8).toUpperCase(),
    isActive: true,
  }))
  .build()
