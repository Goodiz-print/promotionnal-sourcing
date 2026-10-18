import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductDocumentSchema } from '#database/schema'
import Product from '#models/product'
import StorageObject from '#models/storage_object'

/**
 * Fiche technique PDF rattachée à un produit.
 */
export default class ProductDocument extends ProductDocumentSchema {
  static table = 'product_documents'

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => StorageObject, { foreignKey: 'storageObjectId' })
  declare storageObject: BelongsTo<typeof StorageObject>
}
