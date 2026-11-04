import vine from '@vinejs/vine'
import { MARKING_TECHNIQUE_FAMILIES } from '#shared/types/marking'
import { CONTENT_LOCALES } from '#shared/types/i18n'
import { perContentLocale } from '#validators/localized_content'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Nom localisé d'une technique de marquage (fabrique).
 */
const localizedName = () => vine.object({ name: vine.string().minLength(2).maxLength(255).trim() })

const partialLocalizedName = () =>
  vine.object({ name: vine.string().minLength(2).maxLength(255).trim().optional() })

/**
 * Création d'une technique de marquage : slug unique, famille, langue source.
 * Seule la traduction de la langue source est requise (contrôlé par le service).
 */
export const createMarkingTechniqueValidator = vine.create({
  slug: vine
    .string()
    .maxLength(255)
    .regex(slugRegex)
    .unique({ table: 'marking_techniques', column: 'slug' }),
  family: vine.enum(MARKING_TECHNIQUE_FAMILIES),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
  sourceLocale: vine.enum(CONTENT_LOCALES),
  translations: vine.object(perContentLocale(localizedName)),
})

/**
 * Mise à jour partielle. Le slug n'est pas modifiable.
 */
export const updateMarkingTechniqueValidator = vine.create({
  family: vine.enum(MARKING_TECHNIQUE_FAMILIES).optional(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
  sourceLocale: vine.enum(CONTENT_LOCALES).optional(),
  translations: vine.object(perContentLocale(partialLocalizedName)).optional(),
})
