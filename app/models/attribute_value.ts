import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import { AttributeValueSchema } from '#database/schema'
import Attribute from '#models/attribute'
import AttributeValueTranslation from '#models/attribute_value_translation'

export default class AttributeValue extends AttributeValueSchema {
  static table = 'attribute_values'

  declare synonyms: string[]

  @hasMany(() => AttributeValueTranslation)
  declare translations: HasMany<typeof AttributeValueTranslation>

  @belongsTo(() => Attribute)
  declare attribute: BelongsTo<typeof Attribute>
}
