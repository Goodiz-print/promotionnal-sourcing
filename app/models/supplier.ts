import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { SupplierSchema } from '#database/schema'
import Organization from '#models/organization'
import Product from '#models/product'
import SupplierTranslation from '#models/supplier_translation'

export default class Supplier extends SupplierSchema {
  static table = 'suppliers'

  @hasMany(() => SupplierTranslation)
  declare translations: HasMany<typeof SupplierTranslation>

  @hasMany(() => Product)
  declare products: HasMany<typeof Product>

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>
}
