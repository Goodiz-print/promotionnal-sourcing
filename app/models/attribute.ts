import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { AttributeSchema } from '#database/schema'
import AttributeValue from '#models/attribute_value'
import type { AttributeDataType } from '#shared/types/attribute'

export default class Attribute extends AttributeSchema {
  static table = 'attributes'

  declare type: AttributeDataType

  @hasMany(() => AttributeValue)
  declare values: HasMany<typeof AttributeValue>
}
