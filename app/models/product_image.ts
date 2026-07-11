import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductImageSchema } from '#database/schema'
import Product from '#models/product'

export default class ProductImage extends ProductImageSchema {
  static table = 'product_images'

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
