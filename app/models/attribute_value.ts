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

  /**
   * Couleur a 2 niveaux : la famille (N1) d'une nuance (N2). Une nuance pointe
   * vers une valeur de l'attribut `color-family` via `parentValueId`.
   */
  @belongsTo(() => AttributeValue, { foreignKey: 'parentValueId' })
  declare parent: BelongsTo<typeof AttributeValue>

  @hasMany(() => AttributeValue, { foreignKey: 'parentValueId' })
  declare children: HasMany<typeof AttributeValue>
}
