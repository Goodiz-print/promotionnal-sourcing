import { DEFAULT_RFQ_ITEM_QUANTITY } from '#shared/types/rfq'
import type {
  RfqProductOptionType,
  RfqProgress,
  RfqSupplierStatus,
  RfqStatus,
  SupplierRfqState,
} from '#shared/types/rfq'
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
 * une action en attente de l'acheteur, « a décliné » une impasse, « expiré »
 * une échéance passée sans réponse (#232).
 */
export const RFQ_SUPPLIER_STATUS_TONES: Record<RfqSupplierStatus, BadgeTone> = {
  pending: 'warning',
  sent: 'info',
  viewed: 'info',
  responded: 'success',
  declined: 'danger',
  expired: 'warning',
}

/**
 * Tonalité de l'avancement dans « Mes demandes » (#228) : une réponse reçue est
 * un succès, une demande envoyée attend ; une demande publiée mais envoyée à
 * personne (action en attente de l'agence) et une demande échue alertent.
 */
export const RFQ_PROGRESS_TONES: Record<RfqProgress, BadgeTone> = {
  draft: 'neutral',
  published: 'warning',
  sent: 'info',
  responded: 'success',
  expired: 'warning',
  closed: 'neutral',
}

/**
 * Tonalité du statut lisible d'une demande reçue (#230), côté fournisseur : la
 * demande « à traiter » attend une action de sa part, la réponse envoyée est un
 * succès, l'échéance passée alerte, le refus est une impasse.
 */
export const SUPPLIER_RFQ_STATE_TONES: Record<SupplierRfqState, BadgeTone> = {
  to_process: 'info',
  responded: 'success',
  expired: 'warning',
  declined: 'danger',
}
