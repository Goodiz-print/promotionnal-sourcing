import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { AttributeValueSchema } from '#database/schema'
import Attribute from '#models/attribute'

export default class AttributeValue extends AttributeValueSchema {
  static table = 'attribute_values'

  declare synonyms: string[]

  @belongsTo(() => Attribute)
  declare attribute: BelongsTo<typeof Attribute>
}
