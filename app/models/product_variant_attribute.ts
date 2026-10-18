import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductVariantAttributeSchema } from '#database/schema'
import ProductVariant from '#models/product_variant'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'

export default class ProductVariantAttribute extends ProductVariantAttributeSchema {
  static table = 'product_variant_attributes'

  @belongsTo(() => ProductVariant, { foreignKey: 'variantId' })
  declare variant: BelongsTo<typeof ProductVariant>

  @belongsTo(() => Attribute)
  declare attribute: BelongsTo<typeof Attribute>

  @belongsTo(() => AttributeValue)
  declare attributeValue: BelongsTo<typeof AttributeValue>
}
