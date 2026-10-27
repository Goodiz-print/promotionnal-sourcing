import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { MarkingTechniqueSchema } from '#database/schema'
import MarkingTechniqueTranslation from '#models/marking_technique_translation'

/**
 * Technique de marquage (écart 2) : référentiel fermé (~18 canoniques). Mêmes
 * colonnes neutres que les certifications (slug, famille, synonymes d'import) ;
 * le libellé affichable est porté par `translations`.
 */
export default class MarkingTechnique extends MarkingTechniqueSchema {
  static table = 'marking_techniques'

  declare synonyms: string[]

  @hasMany(() => MarkingTechniqueTranslation)
  declare translations: HasMany<typeof MarkingTechniqueTranslation>
}
