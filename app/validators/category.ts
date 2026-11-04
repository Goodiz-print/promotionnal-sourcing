import vine from '@vinejs/vine'
import { CONTENT_LOCALES } from '#shared/types/i18n'
import { CATEGORY_MOVE_DIRECTIONS } from '#shared/types/category'
import { perContentLocale } from '#validators/localized_content'

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Contenu localisé d'une catégorie (fabrique : un nœud VineJS neuf par appel).
 */
const localizedContent = () =>
  vine.object({
    name: vine.string().minLength(2).maxLength(255).trim(),
    description: vine.string().maxLength(2000).trim().optional().nullable(),
  })

/**
 * Contenu localisé en mise à jour : tout est optionnel.
 */
const partialLocalizedContent = () =>
  vine.object({
    name: vine.string().minLength(2).maxLength(255).trim().optional(),
    description: vine.string().maxLength(2000).trim().optional().nullable(),
  })

/**
 * Création d'une catégorie : slug unique + `sourceLocale`. Seule la traduction
 * de la langue source est requise (contrôlé par le service), les autres sont
 * optionnelles et générées. Le parent et les synonymes sont optionnels.
 */
export const createCategoryValidator = vine.create({
  slug: vine
    .string()
    .maxLength(255)
    .regex(slugRegex)
    .unique({ table: 'categories', column: 'slug' }),
  parentId: vine.number().positive().optional().nullable(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
  sourceLocale: vine.enum(CONTENT_LOCALES),
  translations: vine.object(perContentLocale(localizedContent)),
})

/**
 * Mise à jour : le slug n'est pas modifiable (préserve les URLs et les
 * facettes du catalogue qui s'appuient dessus). Partielle : seul ce qui est
 * fourni est modifié.
 */
export const updateCategoryValidator = vine.create({
  parentId: vine.number().positive().optional().nullable(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
  sourceLocale: vine.enum(CONTENT_LOCALES).optional(),
  translations: vine.object(perContentLocale(partialLocalizedContent)).optional(),
})

/**
 * Déplacement d'une catégorie d'un cran parmi ses sœurs (#165).
 */
export const moveCategoryValidator = vine.create({
  direction: vine.enum(CATEGORY_MOVE_DIRECTIONS),
})
