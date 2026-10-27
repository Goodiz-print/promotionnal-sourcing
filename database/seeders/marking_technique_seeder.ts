import { BaseSeeder } from '@adonisjs/lucid/seeders'
import MarkingTechnique from '#models/marking_technique'
import MarkingTechniqueTranslation from '#models/marking_technique_translation'
import type { ContentLocale } from '#shared/types/i18n'
import { MARKING_TECHNIQUES } from '#database/data/catalogue/marking_techniques'

/**
 * Référentiel des techniques de marquage (écart 2), même patron que
 * `certification_seeder` : colonnes neutres sur `marking_techniques`, libellés
 * bilingues dans `marking_technique_translations`. Idempotent (`updateOrCreate`).
 */
export default class MarkingTechniqueSeeder extends BaseSeeder {
  async run() {
    for (const seed of MARKING_TECHNIQUES) {
      const technique = await MarkingTechnique.updateOrCreate(
        { slug: seed.slug },
        { family: seed.family, synonyms: seed.synonyms }
      )
      for (const locale of Object.keys(seed.names) as ContentLocale[]) {
        await MarkingTechniqueTranslation.updateOrCreate(
          { markingTechniqueId: technique.id, locale },
          { name: seed.names[locale]! }
        )
      }
    }
  }
}
