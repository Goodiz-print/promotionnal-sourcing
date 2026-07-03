import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { SupplierSchema } from '#database/schema'
import Product from '#models/product'

export default class Supplier extends SupplierSchema {
  static table = 'suppliers'

  @hasMany(() => Product)
  declare products: HasMany<typeof Product>
}
