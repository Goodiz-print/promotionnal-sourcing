import vine from '@vinejs/vine'

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
 * Création d'une catégorie : slug unique + contenu bilingue requis. Le parent
 * et les synonymes sont optionnels.
 */
export const createCategoryValidator = vine.create({
  slug: vine
    .string()
    .maxLength(255)
    .regex(slugRegex)
    .unique({ table: 'categories', column: 'slug' }),
  parentId: vine.number().positive().optional().nullable(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
  translations: vine.object({
    fr: localizedContent(),
    en: localizedContent(),
  }),
})

/**
 * Mise à jour : le slug n'est pas modifiable (préserve les URLs et les
 * facettes du catalogue qui s'appuient dessus).
 */
export const updateCategoryValidator = vine.create({
  parentId: vine.number().positive().optional().nullable(),
  synonyms: vine.array(vine.string().maxLength(100)).optional(),
  translations: vine.object({
    fr: localizedContent(),
    en: localizedContent(),
  }),
})
