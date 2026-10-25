import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { SupplierContactSchema } from '#database/schema'
import Organization from '#models/organization'

/**
 * Contact commercial d'un fournisseur, visible des agences validées.
 */
export default class SupplierContact extends SupplierContactSchema {
  static table = 'supplier_contacts'

  declare languages: string[]

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>
}
