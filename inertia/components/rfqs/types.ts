import type { RfqSupplierStatus, RfqStatus } from '#shared/types/rfq'

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
  return { name: '', description: '', quantity: null, unit: '', categoryId: null }
}

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

/**
 * Tonalité de la pastille par statut. Le brouillon reste neutre, la demande
 * publiée attire l'œil (une action reste à faire), la clôture s'efface.
 */
export const RFQ_STATUS_TONES: Record<RfqStatus, Tone> = {
  draft: 'neutral',
  published: 'info',
  closed: 'success',
}

/**
 * Côté destinataire, seul « a répondu » est un succès ; « à envoyer » signale
 * une action en attente de l'acheteur, « a décliné » une impasse.
 */
export const RFQ_SUPPLIER_STATUS_TONES: Record<RfqSupplierStatus, Tone> = {
  pending: 'warning',
  sent: 'info',
  viewed: 'info',
  responded: 'success',
  declined: 'danger',
}
