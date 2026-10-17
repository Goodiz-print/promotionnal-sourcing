import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductImageVariantSchema } from '#database/schema'
import ProductImage from '#models/product_image'
import type { ImageVariantName } from '#shared/types/image_variant'

export default class ProductImageVariant extends ProductImageVariantSchema {
  static table = 'product_image_variants'

  declare name: ImageVariantName

  @belongsTo(() => ProductImage)
  declare productImage: BelongsTo<typeof ProductImage>
}
