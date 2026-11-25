/**
 * Grilles de prix dégressives (produit, variante, marquage) : choix du palier
 * atteint et estimation d'une ligne de panier de devis.
 *
 * Les prix sont des décimaux sérialisés en chaîne par Lucid (`decimal(12,4)`).
 * Le calcul se fait en entiers (`bigint`, en dix-millièmes) pour éviter les
 * erreurs d'arrondi des flottants et tout dépassement sur de grosses quantités.
 */

import type { QuoteCartEstimateType } from '../types/quote_cart.js'

/** Palier minimal : à partir de `minQuantity` pièces, `unitPrice` par pièce. */
export interface PriceTierLike {
  minQuantity: number
  unitPrice: string
  currency: string
}

/** Palier de grille produit/variante (`variantId` null = palier du produit). */
export interface VariantPriceTierLike extends PriceTierLike {
  variantId: number | null
}

/** Dix-millièmes : précision des colonnes `decimal(12,4)`. */
const SCALE = 10_000n
/** Les totaux sont arrondis au centime. */
const CENT = 100n

/**
 * Grille applicable à une variante : la sienne si elle en a une, sinon celle
 * du produit (paliers `variantId` null).
 */
export function tiersForVariant<T extends VariantPriceTierLike>(
  tiers: T[],
  variantId: number | null
): T[] {
  const own = variantId === null ? [] : tiers.filter((tier) => tier.variantId === variantId)
  return own.length > 0 ? own : tiers.filter((tier) => tier.variantId === null)
}

function sorted<T extends PriceTierLike>(tiers: T[]): T[] {
  return [...tiers].sort((a, b) => a.minQuantity - b.minQuantity)
}

/** Palier atteint (seuil le plus haut ≤ quantité), `null` sous le premier seuil. */
export function applicableTier<T extends PriceTierLike>(tiers: T[], quantity: number): T | null {
  let found: T | null = null
  for (const tier of sorted(tiers)) {
    if (tier.minQuantity > quantity) break
    found = tier
  }
  return found
}

/**
 * Prochain palier **avantageux** : premier seuil au-dessus de la quantité dont
 * le prix est inférieur à celui du palier atteint (les grilles importées
 * répètent souvent le même prix sur plusieurs seuils). Sous le premier seuil,
 * c'est le premier palier.
 */
export function nextTier<T extends PriceTierLike>(tiers: T[], quantity: number): T | null {
  const current = applicableTier(tiers, quantity)
  const currentUnits = current ? toUnits(current.unitPrice) : null
  return (
    sorted(tiers).find((tier) => {
      if (tier.minQuantity <= quantity) return false
      if (currentUnits === null) return true
      const units = toUnits(tier.unitPrice)
      return units !== null && units < currentUnits
    }) ?? null
  )
}

/** `"1.8500"` → `18500n` (dix-millièmes). Une valeur illisible vaut `null`. */
export function toUnits(value: string | number): bigint | null {
  const text = String(value).trim()
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match) return null
  const [, sign, whole, fraction = ''] = match
  const digits = (fraction + '0000').slice(0, 4)
  const units = BigInt(whole) * SCALE + BigInt(digits)
  return sign ? -units : units
}

/**
 * Dix-millièmes → chaîne décimale, au moins deux décimales, zéros de fin
 * superflus retirés (`18500n` → `"1.85"`, `18525n` → `"1.8525"`).
 */
export function fromUnits(units: bigint): string {
  const negative = units < 0n
  const abs = negative ? -units : units
  const whole = abs / SCALE
  const fraction = (abs % SCALE).toString().padStart(4, '0').replace(/0+$/, '').padEnd(2, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

/** Arrondi au centime, demi vers le haut. */
function roundToCent(units: bigint): bigint {
  const step = SCALE / CENT
  return ((units + step / 2n) / step) * step
}

export interface EstimateLineInput {
  /** Grille produit (ou variante, déjà choisie par `tiersForVariant`). */
  productTiers: PriceTierLike[]
  /** Grille de marquage de la technique choisie (vide sans marquage). */
  markingTiers: PriceTierLike[]
  /** Un marquage est-il choisi sur la ligne ? */
  withMarking: boolean
  /** Frais techniques (setup) de la position-technique choisie, une fois par ligne. */
  setupCharge: string | null
  quantity: number
}

/**
 * Estimation indicative d'une ligne : prix unitaire du palier atteint, prix de
 * marquage unitaire, frais techniques, total et palier suivant.
 *
 * - aucune grille produit → `null` (« prix sur devis ») ;
 * - quantité sous le premier seuil → pas de prix unitaire ni de total,
 *   `nextTier` indique le premier seuil ;
 * - marquage choisi sans prix connu (pas de grille, devise différente) → le
 *   total ne compte que ce qui est connu et `partial` vaut `true`.
 *
 * Les frais techniques sont supposés dans la devise du produit (la grille de
 * marquage reprend elle aussi la devise du produit à la saisie).
 */
export function estimateLine(input: EstimateLineInput): QuoteCartEstimateType | null {
  if (input.productTiers.length === 0) return null

  const tier = applicableTier(input.productTiers, input.quantity)
  const next = nextTier(input.productTiers, input.quantity)
  const currency = (tier ?? next ?? input.productTiers[0]).currency

  const nextUnit = next ? toUnits(next.unitPrice) : null
  const nextTierInfo =
    next && nextUnit !== null
      ? { minQuantity: next.minQuantity, unitPrice: fromUnits(nextUnit), currency: next.currency }
      : null

  const unit = tier ? toUnits(tier.unitPrice) : null

  let markingUnit: bigint | null = null
  let setup: bigint | null = null
  let partial = false
  if (input.withMarking) {
    const marking = applicableTier(
      input.markingTiers.filter((markingTier) => markingTier.currency === currency),
      input.quantity
    )
    markingUnit = marking ? toUnits(marking.unitPrice) : null
    if (markingUnit === null) partial = true
    setup = input.setupCharge !== null ? toUnits(input.setupCharge) : null
  }

  const quantity = BigInt(input.quantity)
  const total =
    unit === null ? null : roundToCent(quantity * (unit + (markingUnit ?? 0n)) + (setup ?? 0n))

  return {
    currency,
    unitPrice: unit === null ? null : fromUnits(unit),
    markingUnitPrice: markingUnit === null ? null : fromUnits(markingUnit),
    setupCharge: setup === null ? null : fromUnits(setup),
    total: total === null ? null : fromUnits(total),
    partial,
    belowFirstTier: tier === null,
    nextTier: nextTierInfo,
  }
}

/**
 * Sous-totaux d'un ensemble d'estimations, un par devise (les totaux de devises
 * différentes ne s'additionnent pas). `complete` est faux dès qu'une ligne n'a
 * pas de total ou un total partiel.
 */
export function sumEstimates(estimates: (QuoteCartEstimateType | null)[]): {
  subtotals: { currency: string; total: string }[]
  complete: boolean
} {
  const sums = new Map<string, bigint>()
  let complete = true
  for (const estimate of estimates) {
    if (!estimate || estimate.total === null) {
      complete = false
      continue
    }
    if (estimate.partial) complete = false
    const units = toUnits(estimate.total) ?? 0n
    sums.set(estimate.currency, (sums.get(estimate.currency) ?? 0n) + units)
  }
  return {
    subtotals: [...sums].map(([currency, total]) => ({ currency, total: fromUnits(total) })),
    complete,
  }
}
