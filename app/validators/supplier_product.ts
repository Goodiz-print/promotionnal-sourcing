import vine from '@vinejs/vine'

/**
 * Contenu localisé d'un produit (fabrique : un nœud VineJS neuf par appel).
 */
const localizedContent = () =>
  vine.object({
    name: vine.string().minLength(2).maxLength(255).trim(),
    description: vine.string().maxLength(5000).trim().optional().nullable(),
  })

/**
 * Formulaire produit fournisseur (create + update). Contenu bilingue requis,
 * facettes et galerie optionnelles. `removedImageIds` n'est utilisé qu'à l'édition.
 */
export const supplierProductValidator = vine.create({
  categoryId: vine.number().positive(),
  translations: vine.object({
    fr: localizedContent(),
    en: localizedContent(),
  }),
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
  removedImageIds: vine.array(vine.number().positive()).optional(),
})
