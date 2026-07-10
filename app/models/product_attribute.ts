import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { ProductAttributeSchema } from '#database/schema'
import Product from '#models/product'
import Attribute from '#models/attribute'
import AttributeValue from '#models/attribute_value'

export default class ProductAttribute extends ProductAttributeSchema {
  static table = 'product_attributes'

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>

  @belongsTo(() => Attribute)
  declare attribute: BelongsTo<typeof Attribute>

  @belongsTo(() => AttributeValue)
  declare attributeValue: BelongsTo<typeof AttributeValue>
}
