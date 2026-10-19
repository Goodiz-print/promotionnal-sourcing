import factory from '@adonisjs/lucid/factories'
import ProductDocument from '#models/product_document'

/**
 * Fiche technique sans fichier réel. `productId` est à fournir par l'appelant.
 */
export const ProductDocumentFactory = factory
  .define(ProductDocument, ({ faker }) => ({
    originalName: `${faker.system.commonFileName('pdf')}`,
    sizeBytes: faker.number.int({ min: 1000, max: 500000 }),
    storageObjectId: null,
  }))
  .build()
