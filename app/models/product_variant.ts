import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { ProductVariantSchema } from '#database/schema'
import Product from '#models/product'
import ProductImage from '#models/product_image'
import ProductPriceTier from '#models/product_price_tier'
import ProductVariantAttribute from '#models/product_variant_attribute'

export default class ProductVariant extends ProductVariantSchema {
  static table = 'product_variants'

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => ProductImage, { foreignKey: 'imageId' })
  declare image: BelongsTo<typeof ProductImage>

  @hasMany(() => ProductVariantAttribute, { foreignKey: 'variantId' })
  declare attributes: HasMany<typeof ProductVariantAttribute>

  @hasMany(() => ProductPriceTier, { foreignKey: 'variantId' })
  declare priceTiers: HasMany<typeof ProductPriceTier>
}
