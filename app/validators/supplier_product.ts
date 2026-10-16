import vine from '@vinejs/vine'
import { TRANSLATION_LOCALES } from '#shared/types/i18n'

/**
 * Contenu localisé d'un produit (fabrique : un nœud VineJS neuf par appel).
 */
const localizedContent = () =>
  vine.object({
    name: vine.string().minLength(2).maxLength(255).trim(),
    description: vine.string().maxLength(5000).trim().optional().nullable(),
  })

/**
 * Champs communs à la création et à l'édition : facettes et galerie optionnelles.
 * `removedImageIds` n'est utilisé qu'à l'édition.
 */
const commonFields = {
  categoryId: vine.number().positive(),
  priceMin: vine.number().positive().optional().nullable(),
  priceMax: vine.number().positive().optional().nullable(),
  currency: vine.string().maxLength(3).optional(),
  minQuantity: vine.number().positive().optional().nullable(),
  originCountry: vine.string().maxLength(2).optional().nullable(),
  madeInEurope: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
  attributeValueIds: vine.array(vine.number().positive()).optional(),
  images: vine
    .array(vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }))
    .maxLength(8)
    .optional(),
}

/**
 * Création : la langue source est obligatoire et le contenu saisi dans cette
 * langue est requis. Les autres langues sont optionnelles et seront générées
 * automatiquement (#75). La présence de la source est vérifiée par le service.
 */
export const createSupplierProductValidator = vine.create({
  ...commonFields,
  sourceLocale: vine.enum(TRANSLATION_LOCALES),
  translations: vine.record(localizedContent()),
})

/**
 * Édition : contenu partiel (seules les langues envoyées sont modifiées), la
 * langue source ne change pas.
 */
export const updateSupplierProductValidator = vine.create({
  ...commonFields,
  translations: vine.record(localizedContent()),
  removedImageIds: vine.array(vine.number().positive()).optional(),
})
