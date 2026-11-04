import vine from '@vinejs/vine'

/**
 * Ajout d'un attribut à une catégorie.
 */
export const addCategoryAttributeValidator = vine.create({
  attributeId: vine.number().positive(),
  isRequiredForPublication: vine.boolean().optional(),
  isFilter: vine.boolean().optional(),
  position: vine.number().min(0).optional(),
})

/**
 * Mise à jour du pivot catégorie-attribut.
 */
export const updateCategoryAttributeValidator = vine.create({
  isRequiredForPublication: vine.boolean().optional(),
  isFilter: vine.boolean().optional(),
  position: vine.number().min(0).optional(),
})

/**
 * Mise à jour des plages d'un attribut numérique.
 */
export const updateCategoryAttributeRangesValidator = vine.create({
  ranges: vine.array(
    vine.object({
      minValue: vine.number().nullable().optional(),
      maxValue: vine.number().nullable().optional(),
    })
  ),
})
