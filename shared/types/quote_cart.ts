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
  /** Variante choisie (couleur/taille), `null` = non précisée. */
  variantId: number | null
  /** Marquage choisi (position + technique), `null` = sans marquage. */
  markingPositionTechniqueId: number | null
  markingColors: number | null
  /** Variantes actives du produit, proposées sur la ligne. */
  variantOptions: QuoteCartVariantOptionType[]
  /** Couples position × technique du produit, proposés sur la ligne. */
  markingOptions: QuoteCartMarkingOptionType[]
  /** Estimation indicative ; `null` si le produit n'a pas de grille (« prix sur devis »). */
  estimate: QuoteCartEstimateType | null
}

/** Variante proposée sur une ligne : libellé « Rouge · L », repli sur le SKU. */
export type QuoteCartVariantOptionType = {
  id: number
  label: string
  sku: string
}

/**
 * Marquage proposé sur une ligne : une technique sur une position
 * (`product_marking_position_techniques.id`), libellé « Face avant — Tampographie ».
 */
export type QuoteCartMarkingOptionType = {
  id: number
  label: string
  positionName: string
  techniqueName: string
  maxColors: number | null
  setupCharge: string | null
}

/**
 * Estimation indicative d'une ligne à partir des grilles dégressives (prix en
 * chaînes décimales, cf. `shared/helpers/price_tiers.ts`). Le devis du
 * fournisseur fait foi.
 */
export type QuoteCartEstimateType = {
  currency: string
  /** Prix unitaire du palier atteint, `null` sous le premier seuil. */
  unitPrice: string | null
  /** Prix unitaire du marquage choisi, `null` sans marquage ou prix inconnu. */
  markingUnitPrice: string | null
  /** Frais techniques du marquage (une fois par ligne). */
  setupCharge: string | null
  /** Total de la ligne, `null` sous le premier seuil. */
  total: string | null
  /** Le marquage choisi n'a pas de prix connu : le total ne le compte pas. */
  partial: boolean
  /** Quantité sous le premier seuil de la grille. */
  belowFirstTier: boolean
  /** Palier suivant, pour inciter à passer le seuil. */
  nextTier: { minQuantity: number; unitPrice: string; currency: string } | null
}

/** Sous-total estimé d'un groupe, dans une devise. */
export type QuoteCartSubtotalType = {
  currency: string
  total: string
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
  /** Sous-totaux estimés, un par devise. */
  subtotals: QuoteCartSubtotalType[]
  /** Faux si une ligne au moins est sur devis, sous le premier seuil ou partielle. */
  estimateComplete: boolean
}

/** Ajout d'un produit (`productId` relu côté serveur, jamais cru sur parole). */
export interface AddQuoteCartItemData {
  productId: number
  quantity?: number | null
  /** Variante choisie sur la fiche ; relue côté serveur (variante active du produit). */
  variantId?: number | null
}

/**
 * Modification d'une ligne. Alias `type` : l'écran du panier l'envoie tel quel
 * en payload `router.patch`, qui exige un objet sérialisable.
 */
export type UpdateQuoteCartItemData = {
  quantity?: number
  note?: string | null
  variantId?: number | null
  markingPositionTechniqueId?: number | null
  markingColors?: number | null
}

/**
 * Clés stables posées dans `rfq_items.specs` à la validation du panier
 * (libellés traduits par `rfq.specs.<clé>` à l'affichage).
 */
export const QUOTE_CART_SPEC_KEYS = [
  'variant',
  'sku',
  'markingPosition',
  'markingTechnique',
  'markingColors',
  'estimatedUnitPrice',
  'estimatedMarkingUnitPrice',
  'estimatedSetupCharge',
  'estimatedTotal',
] as const

export type QuoteCartSpecKey = (typeof QUOTE_CART_SPEC_KEYS)[number]

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
