import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { ProductImageSchema } from '#database/schema'
import Product from '#models/product'
import ProductImageVariant from '#models/product_image_variant'

export default class ProductImage extends ProductImageSchema {
  static table = 'product_images'

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @hasMany(() => ProductImageVariant)
  declare variants: HasMany<typeof ProductImageVariant>
}
