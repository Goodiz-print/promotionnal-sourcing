import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { SupplierSchema } from '#database/schema'
import Product from '#models/product'
import SupplierTranslation from '#models/supplier_translation'

export default class Supplier extends SupplierSchema {
  static table = 'suppliers'

  @hasMany(() => SupplierTranslation)
  declare translations: HasMany<typeof SupplierTranslation>

  @hasMany(() => Product)
  declare products: HasMany<typeof Product>
}
