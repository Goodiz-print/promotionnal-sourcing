import vine from '@vinejs/vine'

/**
 * Borne haute raisonnable pour la position (evite les debordements et valeurs
 * absurdes tout en permettant un ordonnancement large).
 */
const MAX_POSITION = 10_000

/**
 * Ajout d'un attribut à une catégorie.
 */
export const addCategoryAttributeValidator = vine.create({
  attributeId: vine.number().positive().withoutDecimals(),
  isRequiredForPublication: vine.boolean().optional(),
  isFilter: vine.boolean().optional(),
  position: vine.number().withoutDecimals().min(0).max(MAX_POSITION).optional(),
})

/**
 * Mise à jour du pivot catégorie-attribut.
 */
export const updateCategoryAttributeValidator = vine.create({
  isRequiredForPublication: vine.boolean().optional(),
  isFilter: vine.boolean().optional(),
  position: vine.number().withoutDecimals().min(0).max(MAX_POSITION).optional(),
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
