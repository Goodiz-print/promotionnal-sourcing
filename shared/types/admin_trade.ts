import type { AdminActionContext } from '#shared/types/admin_audit'
import type { OrderStatus } from '#shared/types/order'
import type { QuoteStatus } from '#shared/types/quote'
import type { RfqStatus, RfqSupplierStatus } from '#shared/types/rfq'

/**
 * Supervision des demandes de devis, devis et commandes par la plateforme (#166).
 * Types exposés en props Inertia : des `type`, pas des `interface`.
 */

/**
 * Repérage des demandes bloquées : `overdue` = publiée dont l'échéance est
 * passée sans que le job d'expiration soit passé ; `no_response` = publiée depuis
 * `RFQ_REMINDER_AFTER_DAYS` jours sans aucun devis remis.
 */
export const RFQ_ATTENTION_FLAGS = ['overdue', 'no_response'] as const

export type RfqAttentionFlag = (typeof RFQ_ATTENTION_FLAGS)[number]

/** Filtres communs : noms partiels (sans casse) et période de création (`AAAA-MM-JJ`, bornes incluses). */
export type AdminTradePeriodFilters = {
  buyer: string | null
  supplier: string | null
  from: string | null
  to: string | null
}

export type AdminRfqFilters = AdminTradePeriodFilters & {
  status: RfqStatus | null
  attention: RfqAttentionFlag | null
}

export type AdminQuoteFilters = AdminTradePeriodFilters & { status: QuoteStatus | null }

export type AdminOrderFilters = AdminTradePeriodFilters & { status: OrderStatus | null }

export type AdminTradeListOptions<F> = F & { page: number; perPage: number }

export type AdminTradeParty = { id: number; name: string }

export type AdminRfqRow = {
  id: number
  title: string
  status: RfqStatus
  buyer: AdminTradeParty
  deadline: string | null
  publishedAt: string | null
  createdAt: string
  suppliersCount: number
  respondedCount: number
  quotesCount: number
  attention: RfqAttentionFlag | null
}

export type AdminQuoteRow = {
  id: number
  rfqId: number
  rfqTitle: string
  status: QuoteStatus
  buyer: AdminTradeParty
  supplier: AdminTradeParty
  totalAmount: string
  currency: string
  submittedAt: string | null
  validUntil: string | null
  createdAt: string
}

export type AdminOrderRow = {
  id: number
  quoteId: number
  status: OrderStatus
  buyer: AdminTradeParty
  supplier: AdminTradeParty
  totalAmount: string
  currency: string
  createdAt: string
}

export type AdminRfqItemLine = {
  id: number
  name: string
  quantity: number
  unit: string | null
  description: string | null
}

export type AdminRfqRecipient = {
  id: number
  supplier: AdminTradeParty
  status: RfqSupplierStatus
  sentAt: string | null
  remindedAt: string | null
}

export type AdminRfqQuoteLine = {
  id: number
  supplier: AdminTradeParty
  status: QuoteStatus
  totalAmount: string
  currency: string
  submittedAt: string | null
  validUntil: string | null
}

export type AdminRfqDetail = {
  item: AdminRfqRow
  description: string | null
  budgetMax: string | null
  createdByEmail: string | null
  items: AdminRfqItemLine[]
  recipients: AdminRfqRecipient[]
  quotes: AdminRfqQuoteLine[]
  /** Interventions possibles dans l'état courant (indépendamment des droits de l'opérateur). */
  canClose: boolean
  canExpire: boolean
  /** Nombre de destinataires encore relançables (jamais relancés, sans réponse). */
  remindableCount: number
}

export type AdminQuoteItemLine = {
  id: number
  rfqItemName: string
  quantity: number
  unitPrice: string
  totalPrice: string
  leadTimeDays: number
}

export type AdminQuoteDetail = {
  item: AdminQuoteRow
  notes: string | null
  decidedAt: string | null
  items: AdminQuoteItemLine[]
  orderId: number | null
}

export type AdminOrderItemLine = {
  id: number
  name: string
  quantity: number
  unitPrice: string
  totalPrice: string
}

export type AdminOrderDetail = {
  item: AdminOrderRow
  confirmedAt: string | null
  inProductionAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  items: AdminOrderItemLine[]
}

/** Intervention de la plateforme sur une demande : qui agit et d'où (pour l'audit). */
export type AdminRfqInterventionOptions = {
  rfqId: number
  context: AdminActionContext
}
