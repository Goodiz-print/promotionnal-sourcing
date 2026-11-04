import factory from '@adonisjs/lucid/factories'
import Certification from '#models/certification'
import type { CertificationDomain } from '#shared/types/certification'
import type { TranslationLocale } from '#shared/types/i18n'

/**
 * Certification de test (label de conformité, #165). `slug` aléatoire (unique) ;
 * le libellé affichable vit dans `certification_translations` (cf.
 * `CertificationTranslationFactory`).
 */
export const CertificationFactory = factory
  .define(Certification, ({ faker }) => ({
    slug: `cert-${faker.string.alphanumeric({ length: 10, casing: 'lower' })}`,
    domain: faker.helpers.arrayElement([
      'environment',
      'textile',
      'social',
      'safety',
      'food_contact',
      'forestry',
      'quality',
    ]) as CertificationDomain,
    isEco: faker.datatype.boolean(),
    synonyms: [] as string[],
    sourceLocale: 'fr' as TranslationLocale,
  }))
  .build()
