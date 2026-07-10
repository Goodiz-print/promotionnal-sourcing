import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { AttributeSchema } from '#database/schema'
import AttributeValue from '#models/attribute_value'
import AttributeTranslation from '#models/attribute_translation'
import type { AttributeDataType } from '#shared/types/attribute'

export default class Attribute extends AttributeSchema {
  static table = 'attributes'

  declare type: AttributeDataType

  @hasMany(() => AttributeTranslation)
  declare translations: HasMany<typeof AttributeTranslation>

  @hasMany(() => AttributeValue)
  declare values: HasMany<typeof AttributeValue>
}
