import vine from '@vinejs/vine'
import { CONTENT_LOCALES } from '#shared/types/i18n'

/**
 * Contenu localisé d'un produit (fabrique : un nœud VineJS neuf par appel).
 */
const localizedContent = () =>
  vine.object({
    name: vine.string().minLength(2).maxLength(255).trim(),
    description: vine.string().maxLength(5000).trim().optional().nullable(),
  })

/**
 * Contenu localisé en mise à jour : tout est optionnel (on peut corriger la
 * seule description d'une langue).
 */
const partialLocalizedContent = () =>
  vine.object({
    name: vine.string().minLength(2).maxLength(255).trim().optional(),
    description: vine.string().maxLength(5000).trim().optional().nullable(),
  })

const sourceLocale = () => vine.enum(CONTENT_LOCALES)

/**
 * Variante : SKU unique par produit (contrôlé par le service), valeurs
 * d'attribut (couleur = rouge…) et image **déjà en galerie** (édition).
 */
const variantInput = () =>
  vine.object({
    sku: vine.string().minLength(1).maxLength(100).trim(),
    isActive: vine.boolean().optional(),
    imageId: vine.number().positive().optional().nullable(),
    attributeValueIds: vine.array(vine.number().positive()).optional(),
  })

/**
 * Palier de prix dégressif : `variantSku` absent = palier du produit.
 */
const priceTierInput = () =>
  vine.object({
    variantSku: vine.string().maxLength(100).trim().optional().nullable(),
    minQuantity: vine.number().withoutDecimals().positive(),
    unitPrice: vine.number().positive(),
  })

/**
 * Champs communs (colonnes neutres, facettes, galerie).
 */
const commonFields = () => ({
  priceMin: vine.number().positive().optional().nullable(),
  priceMax: vine.number().positive().optional().nullable(),
  currency: vine.string().maxLength(3).optional(),
  minQuantity: vine.number().positive().optional().nullable(),
  originCountry: vine.string().maxLength(2).optional().nullable(),
  madeInEurope: vine.boolean().optional(),
  isActive: vine.boolean().optional(),
  attributeValueIds: vine.array(vine.number().positive()).optional(),
  variants: vine.array(variantInput()).maxLength(100).optional(),
  priceTiers: vine.array(priceTierInput()).maxLength(50).optional(),
  images: vine
    .array(vine.file({ size: '5mb', extnames: ['jpg', 'jpeg', 'png', 'webp'] }))
    .maxLength(8)
    .optional(),
})

/**
 * Création d'un produit fournisseur. `sourceLocale` est obligatoire ; seule la
 * traduction de cette langue est requise (contrôlé par le service), les autres
 * langues sont optionnelles et générées automatiquement si absentes.
 */
export const createSupplierProductValidator = vine.create({
  categoryId: vine.number().positive(),
  sourceLocale: sourceLocale(),
  translations: vine.object({
    fr: localizedContent().optional(),
    en: localizedContent().optional(),
  }),
  ...commonFields(),
})

/**
 * Mise à jour partielle : rien n'est obligatoire. Un champ absent n'est pas
 * modifié ; une seule langue peut être corrigée sans renvoyer le produit.
 * `removedImageIds` n'existe qu'à l'édition.
 */
export const updateSupplierProductValidator = vine.create({
  categoryId: vine.number().positive().optional(),
  sourceLocale: sourceLocale().optional(),
  translations: vine
    .object({
      fr: partialLocalizedContent().optional(),
      en: partialLocalizedContent().optional(),
    })
    .optional(),
  ...commonFields(),
  removedImageIds: vine.array(vine.number().positive()).optional(),
})
