import factory from '@adonisjs/lucid/factories'
import MarkingTechnique from '#models/marking_technique'

/**
 * Technique de marquage (écart 2). `slug` aléatoire (unique) ; le libellé
 * affichable vit dans `marking_technique_translations` (cf.
 * `MarkingTechniqueTranslationFactory`). Même esprit que le référentiel des
 * certifications.
 */
export const MarkingTechniqueFactory = factory
  .define(MarkingTechnique, ({ faker }) => ({
    slug: `technique-${faker.string.alphanumeric({ length: 10, casing: 'lower' })}`,
    family: faker.helpers.arrayElement([
      'print',
      'transfer',
      'engraving',
      'embroidery',
      'relief',
      'special',
    ]),
    synonyms: [] as string[],
  }))
  .build()
