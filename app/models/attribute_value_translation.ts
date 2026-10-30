import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { AttributeValueTranslationSchema } from '#database/schema'
import AttributeValue from '#models/attribute_value'
import type { ContentLocale } from '#shared/types/i18n'

export default class AttributeValueTranslation extends AttributeValueTranslationSchema {
  static table = 'attribute_value_translations'

  declare locale: ContentLocale

  @belongsTo(() => AttributeValue)
  declare attributeValue: BelongsTo<typeof AttributeValue>
}
