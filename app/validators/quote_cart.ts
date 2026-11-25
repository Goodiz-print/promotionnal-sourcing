import vine from '@vinejs/vine'

/** Quantité d'une ligne : un entier positif, borné pour rester un besoin plausible. */
const quantity = () => vine.number().withoutDecimals().positive().max(10_000_000)

/**
 * Ajout au panier (fiche produit, carte du catalogue). Seul l'identifiant du
 * produit voyage, avec éventuellement une quantité : le reste est relu dans le
 * catalogue par le service.
 */
export const quoteCartItemValidator = vine.create({
  productId: vine.number().positive(),
  quantity: quantity().optional().nullable(),
  variantId: vine.number().withoutDecimals().positive().optional().nullable(),
})

/** Modification d'une ligne depuis l'écran du panier. */
export const quoteCartItemUpdateValidator = vine.create({
  quantity: quantity().optional(),
  note: vine.string().maxLength(2000).trim().optional().nullable(),
  // Options : identifiants relus par le service (appartenance au produit).
  variantId: vine.number().withoutDecimals().positive().optional().nullable(),
  markingPositionTechniqueId: vine.number().withoutDecimals().positive().optional().nullable(),
  markingColors: vine.number().withoutDecimals().min(1).max(20).optional().nullable(),
})

/**
 * Validation du panier : en-tête commun aux demandes créées. Le titre est
 * suffixé du nom de chaque fournisseur, d'où une longueur plus courte que
 * celle d'une demande (180).
 */
export const quoteCartCheckoutValidator = vine.create({
  title: vine.string().minLength(3).maxLength(120).trim(),
  description: vine.string().maxLength(5000).trim().optional().nullable(),
  deadline: vine
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
})
