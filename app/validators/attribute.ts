import vine from '@vinejs/vine'
import { ATTRIBUTE_DATA_TYPES } from '#shared/types/attribute'
import { CONTENT_LOCALES } from '#shared/types/i18n'
import { perContentLocale } from '#validators/localized_content'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Nom localisé d'une facette (fabrique : un nœud VineJS neuf par appel).
 */
const localizedName = () => vine.object({ name: vine.string().minLength(2).maxLength(255).trim() })

const partialLocalizedName = () =>
  vine.object({ name: vine.string().minLength(2).maxLength(255).trim().optional() })

const localizedLabel = () =>
  vine.object({ label: vine.string().minLength(1).maxLength(255).trim() })

const partialLocalizedLabel = () =>
  vine.object({ label: vine.string().minLength(1).maxLength(255).trim().optional() })

/**
 * Création d'une facette : slug unique, type et langue source. Seule la
 * traduction de la langue source est requise (contrôlé par le service).
 */
export const createAttributeValidator = vine.create({
  slug: vine
    .string()
    .maxLength(255)
    .regex(slugRegex)
    .unique({ table: 'attributes', column: 'slug' }),
  type: vine.enum(ATTRIBUTE_DATA_TYPES),
  unit: vine.string().maxLength(30).trim().optional().nullable(),
  isFilterable: vine.boolean().optional(),
  sourceLocale: vine.enum(CONTENT_LOCALES),
  translations: vine.object(perContentLocale(localizedName)),
})

/**
 * Mise à jour partielle. Le slug et le type ne sont pas modifiables : les
 * produits, les filtres et les URLs du catalogue s'appuient dessus.
 */
export const updateAttributeValidator = vine.create({
  unit: vine.string().maxLength(30).trim().optional().nullable(),
  isFilterable: vine.boolean().optional(),
  sourceLocale: vine.enum(CONTENT_LOCALES).optional(),
  translations: vine.object(perContentLocale(partialLocalizedName)).optional(),
})

export const createAttributeValueValidator = vine.create({
  slug: vine.string().maxLength(255).regex(slugRegex),
  sourceLocale: vine.enum(CONTENT_LOCALES),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
  translations: vine.object(perContentLocale(localizedLabel)),
})

export const updateAttributeValueValidator = vine.create({
  sourceLocale: vine.enum(CONTENT_LOCALES).optional(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
  translations: vine.object(perContentLocale(partialLocalizedLabel)).optional(),
})
