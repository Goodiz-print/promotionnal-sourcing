import factory from '@adonisjs/lucid/factories'
import ProductMarkingPosition from '#models/product_marking_position'

/**
 * Zone de marquage d'un produit (écart 2). `productId` est à fournir par
 * l'appelant (`.merge({ productId })`). `templateDocumentId` null par défaut.
 */
export const ProductMarkingPositionFactory = factory
  .define(ProductMarkingPosition, ({ faker }) => ({
    name: faker.helpers.arrayElement(['Devant', 'Dos', 'Côté gauche', 'Manche']),
    maxWidthMm: faker.number.int({ min: 20, max: 200 }),
    maxHeightMm: faker.number.int({ min: 20, max: 150 }),
    templateDocumentId: null,
    position: 0,
  }))
  .build()
