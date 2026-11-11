/**
 * Panier de devis (cf. `docs/quote-cart.md`) : l'acheteur y met des produits du
 * catalogue, puis le valide — une demande de devis (RFQ) par fournisseur.
 */

/**
 * Ligne du panier, telle que l'écran du panier l'affiche. Alias `type` (et non
 * `interface`) : une prop Inertia doit être assignable à un objet sérialisable,
 * ce qu'une interface (sans signature d'index) n'est pas.
 */
export type QuoteCartItemType = {
  id: number
  productId: number
  productSlug: string
  productName: string
  imageUrl: string | null
  minQuantity: number | null
  quantity: number
  note: string | null
}

/**
 * Lignes d'un même fournisseur : elles deviendront **une** demande à la
 * validation. `supplierOrganizationId` est `null` pour le groupe des produits
 * dont le fournisseur n'a pas (ou plus) de compte joignable sur la plateforme :
 * ce groupe n'est pas envoyable et reste au panier.
 */
export type QuoteCartGroupType = {
  supplierOrganizationId: number | null
  supplierName: string | null
  items: QuoteCartItemType[]
}

/** Ajout d'un produit (`productId` relu côté serveur, jamais cru sur parole). */
export interface AddQuoteCartItemData {
  productId: number
  quantity?: number | null
}

export interface UpdateQuoteCartItemData {
  quantity?: number
  note?: string | null
}

/** Formulaire de validation : en-tête commun à toutes les demandes créées. */
export interface QuoteCartCheckoutData {
  title: string
  description?: string | null
  deadline?: string | null
}

/** Issue d'une validation : demandes créées, et combien ont été envoyées. */
export interface QuoteCartCheckoutResult {
  rfqIds: number[]
  sent: boolean
}
