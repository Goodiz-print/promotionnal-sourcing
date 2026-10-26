import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Certification from '#models/certification'
import CertificationTranslation from '#models/certification_translation'
import type { ContentLocale } from '#shared/types/i18n'
import { CERTIFICATIONS } from '#database/data/catalogue/certifications'

/**
 * Référentiel des labels de conformité produit (écart 4), même patron que
 * `attribute_seeder` : colonnes neutres sur `certifications`, libellés bilingues
 * dans `certification_translations`. Idempotent (`updateOrCreate`).
 */
export default class CertificationSeeder extends BaseSeeder {
  async run() {
    for (const seed of CERTIFICATIONS) {
      const certification = await Certification.updateOrCreate(
        { slug: seed.slug },
        { domain: seed.domain, isEco: seed.isEco, synonyms: seed.synonyms }
      )
      for (const locale of Object.keys(seed.names) as ContentLocale[]) {
        await CertificationTranslation.updateOrCreate(
          { certificationId: certification.id, locale },
          { name: seed.names[locale]! }
        )
      }
    }
  }
}
