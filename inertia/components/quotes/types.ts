import type { QuoteStatus } from '#shared/types/quote'
import type { BadgeTone } from '~/types/ui'

/**
 * Tonalité de la pastille par statut : le brouillon reste neutre, le devis
 * remis attend une décision (info), l'accepté est le seul succès, le rejeté une
 * impasse, l'expiré s'efface.
 */
export const QUOTE_STATUS_TONES: Record<QuoteStatus, BadgeTone> = {
  draft: 'neutral',
  submitted: 'info',
  accepted: 'success',
  rejected: 'danger',
  expired: 'warning',
}

/**
 * Ligne du formulaire de devis, une par item de la demande. Une ligne dont
 * `unitPrice` est vide n'est pas chiffrée : elle n'est pas envoyée.
 */
export interface QuoteLineState {
  rfqItemId: number
  unitPrice: number | null
  quantity: number | null
  leadTimeDays: number | null
  customization: string
}

export interface QuoteFormState {
  validUntil: string
  notes: string
  lines: QuoteLineState[]
}

/** Montant formaté dans la langue et la devise du devis. */
export function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

/** Total d'une ligne en cours de saisie ; `null` tant qu'elle n'est pas chiffrée. */
export function lineTotal(line: QuoteLineState): number | null {
  if (line.unitPrice === null || line.quantity === null) return null
  return Math.round(line.unitPrice * line.quantity * 100) / 100
}

/** Date `AAAA-MM-JJ` affichée dans la langue de l'utilisateur, sans décalage de fuseau. */
export function formatDay(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, { timeZone: 'UTC' })
}
