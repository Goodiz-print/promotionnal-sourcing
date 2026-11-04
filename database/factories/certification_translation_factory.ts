import factory from '@adonisjs/lucid/factories'
import CertificationTranslation from '#models/certification_translation'

/**
 * Traduction d'une certification (label de conformité, #165).
 * `certificationId` et `locale` sont à fournir par l'appelant
 * (`.merge({ certificationId, locale })`).
 */
export const CertificationTranslationFactory = factory
  .define(CertificationTranslation, ({ faker }) => ({
    locale: 'fr' as const,
    name: faker.commerce.productAdjective(),
    isAuto: false,
  }))
  .build()
