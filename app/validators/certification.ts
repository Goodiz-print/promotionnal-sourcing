import vine from '@vinejs/vine'
import { CERTIFICATION_DOMAINS } from '#shared/types/certification'
import { CONTENT_LOCALES } from '#shared/types/i18n'
import { perContentLocale } from '#validators/localized_content'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Nom localisé d'une certification (fabrique : un noeud VineJS neuf par appel).
 */
const localizedName = () => vine.object({ name: vine.string().minLength(2).maxLength(255).trim() })

const partialLocalizedName = () =>
  vine.object({ name: vine.string().minLength(2).maxLength(255).trim().optional() })

/**
 * Création d'une certification : slug unique, domaine, is_eco, langue source.
 * Seule la traduction de la langue source est requise (contrôlé par le service).
 */
export const createCertificationValidator = vine.create({
  slug: vine
    .string()
    .maxLength(255)
    .regex(slugRegex)
    .unique({ table: 'certifications', column: 'slug' }),
  domain: vine.enum(CERTIFICATION_DOMAINS),
  isEco: vine.boolean(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
  sourceLocale: vine.enum(CONTENT_LOCALES),
  translations: vine.object(perContentLocale(localizedName)),
})

/**
 * Mise à jour partielle. Le slug n'est pas modifiable.
 */
export const updateCertificationValidator = vine.create({
  domain: vine.enum(CERTIFICATION_DOMAINS).optional(),
  isEco: vine.boolean().optional(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
  sourceLocale: vine.enum(CONTENT_LOCALES).optional(),
  translations: vine.object(perContentLocale(partialLocalizedName)).optional(),
})
