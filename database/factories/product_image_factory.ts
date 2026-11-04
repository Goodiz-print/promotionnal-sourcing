import factory from '@adonisjs/lucid/factories'
import ProductImage from '#models/product_image'

/**
 * Image produit de test. `productId` est à fournir par l'appelant via
 * `.merge({ productId })`. Pas de `storageObjectId` : seule l'existence de
 * la ligne dans `product_images` compte pour le filtre `quality=no_image`.
 */
export const ProductImageFactory = factory
  .define(ProductImage, ({ faker }) => ({
    secureUrl: `https://cdn.example.com/${faker.string.alphanumeric(16)}.jpg`,
    position: 0,
  }))
  .build()
