import { DEFAULT_RFQ_ITEM_QUANTITY } from '#shared/types/rfq'
import type { RfqProductOptionType, RfqSupplierStatus, RfqStatus } from '#shared/types/rfq'
import type { BadgeTone } from '~/types/ui'

/**
 * Ligne du formulaire de demande. `quantity` est `number | null` : le champ
 * peut être vide en cours de saisie, VineJS exige un entier positif à l'envoi.
 */
export interface RfqItemFormState {
  name: string
  description: string
  quantity: number | null
  unit: string
  categoryId: number | null
  // Produit du catalogue visé, s'il y en a un : doit survivre à l'édition.
  productId: number | null
}

export interface RfqFormState {
  title: string
  description: string
  deadline: string
  budgetMax: number | null
  items: RfqItemFormState[]
  supplierOrganizationIds: number[]
}

export function emptyRfqItem(): RfqItemFormState {
  return { name: '', description: '', quantity: null, unit: '', categoryId: null, productId: null }
}

/**
 * Ligne pré-remplie depuis un produit du catalogue : désignation, catégorie et
 * quantité minimale (à défaut, 1 — l'acheteur l'ajuste).
 */
export function itemFromProduct(product: RfqProductOptionType): RfqItemFormState {
  return {
    ...emptyRfqItem(),
    name: product.name,
    quantity: product.minQuantity ?? DEFAULT_RFQ_ITEM_QUANTITY,
    categoryId: product.categoryId,
    productId: product.id,
  }
}

/**
 * Tonalité de la pastille par statut. Le brouillon reste neutre, la demande
 * publiée attire l'œil (une action reste à faire), la clôture s'efface.
 */
export const RFQ_STATUS_TONES: Record<RfqStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'info',
  closed: 'neutral',
  expired: 'warning',
}

/**
 * Côté destinataire, seul « a répondu » est un succès ; « à envoyer » signale
 * une action en attente de l'acheteur, « a décliné » une impasse.
 */
export const RFQ_SUPPLIER_STATUS_TONES: Record<RfqSupplierStatus, BadgeTone> = {
  pending: 'warning',
  sent: 'info',
  viewed: 'info',
  responded: 'success',
  declined: 'danger',
}
