import factory from '@adonisjs/lucid/factories'
import MarkingTechniqueTranslation from '#models/marking_technique_translation'

/**
 * Libellé traduit d'une technique de marquage (écart 2). `markingTechniqueId` et
 * `locale` sont à fournir par l'appelant (`.merge({ markingTechniqueId, locale })`).
 */
export const MarkingTechniqueTranslationFactory = factory
  .define(MarkingTechniqueTranslation, ({ faker }) => ({
    locale: 'fr' as const,
    name: faker.commerce.productAdjective(),
  }))
  .build()
