import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { MarkingTechniqueTranslationSchema } from '#database/schema'
import MarkingTechnique from '#models/marking_technique'
import type { ContentLocale } from '#shared/types/i18n'

export default class MarkingTechniqueTranslation extends MarkingTechniqueTranslationSchema {
  static table = 'marking_technique_translations'

  declare locale: ContentLocale

  @belongsTo(() => MarkingTechnique)
  declare markingTechnique: BelongsTo<typeof MarkingTechnique>
}
