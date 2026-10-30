import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { CertificationTranslationSchema } from '#database/schema'
import Certification from '#models/certification'
import type { ContentLocale } from '#shared/types/i18n'

export default class CertificationTranslation extends CertificationTranslationSchema {
  static table = 'certification_translations'

  declare locale: ContentLocale

  @belongsTo(() => Certification)
  declare certification: BelongsTo<typeof Certification>
}
