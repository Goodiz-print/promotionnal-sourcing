import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { ProductImageSchema } from '#database/schema'
import Product from '#models/product'
import ProductImageVariant from '#models/product_image_variant'
import type { ProductImageRole } from '#shared/types/product'

export default class ProductImage extends ProductImageSchema {
  static table = 'product_images'

  /** Rôle de l'image dans la galerie (écart 8) ; `null` = non typé. */
  declare role: ProductImageRole | null

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @hasMany(() => ProductImageVariant)
  declare variants: HasMany<typeof ProductImageVariant>
}
