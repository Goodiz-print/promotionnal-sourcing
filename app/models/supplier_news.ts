import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SupplierNewSchema } from '#database/schema'
import Organization from '#models/organization'
import StorageObject from '#models/storage_object'

/**
 * Actualité publiée sur la page d'un fournisseur.
 */
export default class SupplierNews extends SupplierNewSchema {
  static table = 'supplier_news'

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => StorageObject, { foreignKey: 'imageStorageObjectId' })
  declare imageStorageObject: BelongsTo<typeof StorageObject>
}
