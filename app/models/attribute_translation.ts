import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { AttributeTranslationSchema } from '#database/schema'
import Attribute from '#models/attribute'
import type { ContentLocale } from '#shared/types/i18n'

export default class AttributeTranslation extends AttributeTranslationSchema {
  static table = 'attribute_translations'

  declare locale: ContentLocale

  @belongsTo(() => Attribute)
  declare attribute: BelongsTo<typeof Attribute>
}
