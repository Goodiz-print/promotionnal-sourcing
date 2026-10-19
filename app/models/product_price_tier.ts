import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductPriceTierSchema } from '#database/schema'
import Product from '#models/product'
import ProductVariant from '#models/product_variant'

export default class ProductPriceTier extends ProductPriceTierSchema {
  static table = 'product_price_tiers'

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => ProductVariant, { foreignKey: 'variantId' })
  declare variant: BelongsTo<typeof ProductVariant>
}
