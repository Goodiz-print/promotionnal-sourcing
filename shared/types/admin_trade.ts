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

/**
 * Lignes brutes lues en base par `AdminTradeService` (colonnes `snake_case`, dates
 * en `Date` ou chaîne selon le driver). Elles ne quittent pas le service : il les
 * présente en DTO (`Admin*Row`, `Admin*Detail`).
 */
type DbDate = Date | string | null

export type AdminRfqDbRow = {
  id: number
  title: string
  status: RfqStatus
  deadline: DbDate
  published_at: DbDate
  created_at: Date | string
  buyer_id: number
  buyer_name: string
  suppliers_count: string | number
  responded_count: string | number
  quotes_count: string | number
  attention: RfqAttentionFlag | null
  description?: string | null
  budget_max?: string | null
  created_by_email?: string | null
}

export type AdminQuoteDbRow = {
  id: number
  rfq_id: number
  rfq_title: string
  status: QuoteStatus
  total_amount: string
  currency: string
  submitted_at: DbDate
  valid_until: DbDate
  created_at: Date | string
  buyer_id: number
  buyer_name: string
  supplier_id: number
  supplier_name: string
  notes?: string | null
  decided_at?: DbDate
}

export type AdminOrderDbRow = {
  id: number
  quote_id: number
  status: OrderStatus
  total_amount: string
  currency: string
  created_at: Date | string
  buyer_id: number
  buyer_name: string
  supplier_id: number
  supplier_name: string
  confirmed_at?: DbDate
  in_production_at?: DbDate
  shipped_at?: DbDate
  delivered_at?: DbDate
  cancelled_at?: DbDate
}

export type AdminRfqItemDbRow = {
  id: number
  name: string
  quantity: number
  unit: string | null
  description: string | null
}

export type AdminRfqRecipientDbRow = {
  id: number
  supplier_id: number
  supplier_name: string
  status: RfqSupplierStatus
  sent_at: DbDate
  reminded_at: DbDate
}

export type AdminRfqQuoteDbRow = {
  id: number
  supplier_id: number
  supplier_name: string
  status: QuoteStatus
  total_amount: string
  currency: string
  submitted_at: DbDate
  valid_until: DbDate
}

export type AdminQuoteItemDbRow = {
  id: number
  rfq_item_name: string
  quantity: number
  unit_price: string
  total_price: string
  lead_time_days: number
}

export type AdminOrderItemDbRow = {
  id: number
  name: string
  quantity: number
  unit_price: string
  total_price: string
}
