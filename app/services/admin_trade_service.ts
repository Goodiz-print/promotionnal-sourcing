import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { AdminTradeNotFoundException } from '#exceptions/admin_trade_errors'
import {
  RFQ_DEADLINE_TIMEZONE,
  RFQ_REMINDER_AFTER_DAYS,
  type RfqStatus,
  type RfqSupplierStatus,
} from '#shared/types/rfq'
import type { QuoteStatus } from '#shared/types/quote'
import type { OrderStatus } from '#shared/types/order'
import type { Paginated } from '#shared/types/pagination'
import type {
  AdminOrderDetail,
  AdminOrderFilters,
  AdminOrderRow,
  AdminQuoteDetail,
  AdminQuoteFilters,
  AdminQuoteRow,
  AdminRfqDetail,
  AdminRfqFilters,
  AdminRfqRow,
  AdminTradeListOptions,
  AdminTradePeriodFilters,
  RfqAttentionFlag,
} from '#shared/types/admin_trade'

type Row = Record<string, any>
type Query = ReturnType<typeof db.from>

/** Demande publiée dont l'échéance est passée : le job d'expiration ne l'a pas encore basculée. */
const OVERDUE = `(r.status = 'published' AND r.deadline IS NOT NULL AND r.deadline < ?)`

/** Demande ouverte depuis un moment, sans aucun devis remis (soumis, accepté ou refusé). */
const NO_RESPONSE = `(r.status = 'published' AND (r.deadline IS NULL OR r.deadline >= ?)
  AND r.published_at <= ?
  AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.rfq_id = r.id AND q.status <> 'draft'))`

const iso = (value: Date | string | null | undefined): string | null =>
  value ? new Date(value).toISOString() : null

const party = (id: number, name: string) => ({ id, name })

/** Échappe les jokers `LIKE` : le terme saisi est cherché tel quel. */
const contains = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`

/**
 * Consultation transverse des demandes de devis, devis et commandes par
 * l'équipe plateforme (#166), tous acheteurs et fournisseurs confondus. Lecture
 * seule : les interventions sont dans `AdminRfqInterventionService`.
 */
export default class AdminTradeService {
  async listRfqs(options: AdminTradeListOptions<AdminRfqFilters>): Promise<Paginated<AdminRfqRow>> {
    const { page, perPage, status, attention } = options
    const { today, sentBefore } = this.reference()

    const query = this.rfqBase()
    if (status) query.where('r.status', status)
    if (attention === 'overdue') query.whereRaw(OVERDUE, [today])
    if (attention === 'no_response') query.whereRaw(NO_RESPONSE, [today, sentBefore])
    this.byParties(
      query,
      options,
      `EXISTS (SELECT 1 FROM rfq_suppliers rs JOIN organizations s ON s.id = rs.supplier_organization_id
        WHERE rs.rfq_id = r.id AND s.name ILIKE ?)`
    )
    this.byPeriod(query, options, 'r.created_at')

    const { total, rows } = await this.page(query, page, perPage, (q) =>
      this.selectRfq(q, today, sentBefore).orderBy('r.created_at', 'desc').orderBy('r.id', 'desc')
    )
    return this.paginated(
      rows.map((row) => this.presentRfq(row)),
      total,
      page,
      perPage
    )
  }

  async rfqDetail(id: number): Promise<AdminRfqDetail> {
    const { today, sentBefore } = this.reference()
    const row = await this.selectRfq(this.rfqBase(), today, sentBefore)
      .select('r.description', 'r.budget_max', 'u.email as created_by_email')
      .leftJoin('users as u', 'u.id', 'r.created_by_user_id')
      .where('r.id', id)
      .first()
    if (!row) throw new AdminTradeNotFoundException()

    const [items, recipients, quotes] = await Promise.all([
      db
        .from('rfq_items')
        .where('rfq_id', id)
        .select('id', 'name', 'quantity', 'unit', 'description')
        .orderBy('id'),
      db
        .from('rfq_suppliers as rs')
        .join('organizations as s', 's.id', 'rs.supplier_organization_id')
        .where('rs.rfq_id', id)
        .select('rs.id', 's.id as supplier_id', 's.name as supplier_name')
        .select('rs.status', 'rs.sent_at', 'rs.reminded_at')
        .orderBy('rs.id'),
      db
        .from('quotes as q')
        .join('organizations as s', 's.id', 'q.supplier_organization_id')
        .where('q.rfq_id', id)
        .select('q.id', 's.id as supplier_id', 's.name as supplier_name')
        .select('q.status', 'q.total_amount', 'q.currency', 'q.submitted_at', 'q.valid_until')
        .orderBy('q.id'),
    ])

    const item = this.presentRfq(row)
    const open = item.status === 'published'
    return {
      item,
      description: row.description,
      budgetMax: row.budget_max,
      createdByEmail: row.created_by_email,
      items: items.map((line: Row) => ({
        id: line.id,
        name: line.name,
        quantity: line.quantity,
        unit: line.unit,
        description: line.description,
      })),
      recipients: recipients.map((line: Row) => ({
        id: line.id,
        supplier: party(line.supplier_id, line.supplier_name),
        status: line.status as RfqSupplierStatus,
        sentAt: iso(line.sent_at),
        remindedAt: iso(line.reminded_at),
      })),
      quotes: quotes.map((line: Row) => ({
        id: line.id,
        supplier: party(line.supplier_id, line.supplier_name),
        status: line.status as QuoteStatus,
        totalAmount: line.total_amount,
        currency: line.currency,
        submittedAt: iso(line.submitted_at),
        validUntil: iso(line.valid_until),
      })),
      canClose: open,
      canExpire: open,
      remindableCount:
        item.attention === 'overdue' || !open
          ? 0
          : recipients.filter(
              (line: Row) => ['sent', 'viewed'].includes(line.status) && !line.reminded_at
            ).length,
    }
  }

  async listQuotes(
    options: AdminTradeListOptions<AdminQuoteFilters>
  ): Promise<Paginated<AdminQuoteRow>> {
    const { page, perPage, status } = options
    const query = this.quoteBase()
    if (status) query.where('q.status', status)
    this.byParties(query, options)
    this.byPeriod(query, options, 'q.created_at')

    const { total, rows } = await this.page(query, page, perPage, (q) =>
      this.selectQuote(q).orderBy('q.created_at', 'desc').orderBy('q.id', 'desc')
    )
    return this.paginated(
      rows.map((row) => this.presentQuote(row)),
      total,
      page,
      perPage
    )
  }

  async quoteDetail(id: number): Promise<AdminQuoteDetail> {
    const row = await this.selectQuote(this.quoteBase())
      .select('q.notes', 'q.decided_at')
      .where('q.id', id)
      .first()
    if (!row) throw new AdminTradeNotFoundException()

    const [items, order] = await Promise.all([
      db
        .from('quote_items as qi')
        .join('rfq_items as ri', 'ri.id', 'qi.rfq_item_id')
        .where('qi.quote_id', id)
        .select('qi.id', 'ri.name as rfq_item_name', 'qi.quantity', 'qi.unit_price')
        .select('qi.total_price', 'qi.lead_time_days')
        .orderBy('qi.id'),
      db.from('orders').where('quote_id', id).select('id').first(),
    ])

    return {
      item: this.presentQuote(row),
      notes: row.notes,
      decidedAt: iso(row.decided_at),
      items: items.map((line: Row) => ({
        id: line.id,
        rfqItemName: line.rfq_item_name,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        totalPrice: line.total_price,
        leadTimeDays: line.lead_time_days,
      })),
      orderId: order?.id ?? null,
    }
  }

  async listOrders(
    options: AdminTradeListOptions<AdminOrderFilters>
  ): Promise<Paginated<AdminOrderRow>> {
    const { page, perPage, status } = options
    const query = this.orderBase()
    if (status) query.where('o.status', status)
    this.byParties(query, options)
    this.byPeriod(query, options, 'o.created_at')

    const { total, rows } = await this.page(query, page, perPage, (q) =>
      this.selectOrder(q).orderBy('o.created_at', 'desc').orderBy('o.id', 'desc')
    )
    return this.paginated(
      rows.map((row) => this.presentOrder(row)),
      total,
      page,
      perPage
    )
  }

  async orderDetail(id: number): Promise<AdminOrderDetail> {
    const row = await this.selectOrder(this.orderBase())
      .select('o.confirmed_at', 'o.in_production_at', 'o.shipped_at')
      .select('o.delivered_at', 'o.cancelled_at')
      .where('o.id', id)
      .first()
    if (!row) throw new AdminTradeNotFoundException()

    const items = await db
      .from('order_items')
      .where('order_id', id)
      .select('id', 'name', 'quantity', 'unit_price', 'total_price')
      .orderBy('id')

    return {
      item: this.presentOrder(row),
      confirmedAt: iso(row.confirmed_at),
      inProductionAt: iso(row.in_production_at),
      shippedAt: iso(row.shipped_at),
      deliveredAt: iso(row.delivered_at),
      cancelledAt: iso(row.cancelled_at),
      items: items.map((line: Row) => ({
        id: line.id,
        name: line.name,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        totalPrice: line.total_price,
      })),
    }
  }

  /** Repères temporels du repérage des demandes bloquées (jour calendaire de Paris, comme l'expiration). */
  private reference() {
    const now = DateTime.now()
    return {
      today: now.setZone(RFQ_DEADLINE_TIMEZONE).startOf('day').toSQL()!,
      sentBefore: now.minus({ days: RFQ_REMINDER_AFTER_DAYS }).toSQL()!,
    }
  }

  private rfqBase() {
    return db.from('rfqs as r').join('organizations as b', 'b.id', 'r.buyer_organization_id')
  }

  private quoteBase() {
    return db
      .from('quotes as q')
      .join('rfqs as r', 'r.id', 'q.rfq_id')
      .join('organizations as b', 'b.id', 'r.buyer_organization_id')
      .join('organizations as s', 's.id', 'q.supplier_organization_id')
  }

  private orderBase() {
    return db
      .from('orders as o')
      .join('organizations as b', 'b.id', 'o.buyer_organization_id')
      .join('organizations as s', 's.id', 'o.supplier_organization_id')
  }

  private selectRfq(query: Query, today: string, sentBefore: string) {
    return query
      .select('r.id', 'r.title', 'r.status', 'r.deadline', 'r.published_at', 'r.created_at')
      .select('b.id as buyer_id', 'b.name as buyer_name')
      .select(
        db.raw('(SELECT count(*) FROM rfq_suppliers rs WHERE rs.rfq_id = r.id) AS suppliers_count'),
        db.raw(
          `(SELECT count(*) FROM rfq_suppliers rs WHERE rs.rfq_id = r.id AND rs.status = 'responded') AS responded_count`
        ),
        db.raw(
          `(SELECT count(*) FROM quotes q WHERE q.rfq_id = r.id AND q.status <> 'draft') AS quotes_count`
        ),
        db.raw(
          `CASE WHEN ${OVERDUE} THEN 'overdue' WHEN ${NO_RESPONSE} THEN 'no_response' END AS attention`,
          [today, today, sentBefore]
        )
      )
  }

  private selectQuote(query: Query) {
    return query
      .select('q.id', 'q.rfq_id', 'q.status', 'q.total_amount', 'q.currency', 'q.submitted_at')
      .select('q.valid_until', 'q.created_at', 'r.title as rfq_title')
      .select('b.id as buyer_id', 'b.name as buyer_name')
      .select('s.id as supplier_id', 's.name as supplier_name')
  }

  private selectOrder(query: Query) {
    return query
      .select('o.id', 'o.quote_id', 'o.status', 'o.total_amount', 'o.currency', 'o.created_at')
      .select('b.id as buyer_id', 'b.name as buyer_name')
      .select('s.id as supplier_id', 's.name as supplier_name')
  }

  /**
   * Filtres par nom d'organisation (partiel, sans casse). L'acheteur est joint
   * sous l'alias `b`. Le fournisseur l'est sous `s`, sauf pour les demandes qui en
   * ont plusieurs : `supplierExists` est alors le prédicat `EXISTS … ILIKE ?`.
   */
  private byParties(query: Query, filters: AdminTradePeriodFilters, supplierExists?: string) {
    if (filters.buyer) query.whereRaw('b.name ILIKE ?', [contains(filters.buyer)])
    if (filters.supplier) {
      query.whereRaw(supplierExists ?? 's.name ILIKE ?', [contains(filters.supplier)])
    }
  }

  /** Période sur la date de création, bornes incluses (`to` couvre toute sa journée). */
  private byPeriod(query: Query, filters: AdminTradePeriodFilters, column: string) {
    if (filters.from) query.where(column, '>=', DateTime.fromISO(filters.from).toSQL()!)
    if (filters.to)
      query.where(column, '<', DateTime.fromISO(filters.to).plus({ days: 1 }).toSQL()!)
  }

  private async page(
    query: Query,
    page: number,
    perPage: number,
    select: (query: Query) => Query
  ): Promise<{ total: number; rows: Row[] }> {
    const count = await query.clone().count('* as total').first()
    const rows = await select(query)
      .limit(perPage)
      .offset((page - 1) * perPage)
    return { total: Number(count?.total ?? 0), rows }
  }

  private paginated<T>(data: T[], total: number, page: number, perPage: number): Paginated<T> {
    return {
      data,
      meta: {
        total,
        perPage,
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(total / perPage)),
      },
    }
  }

  private presentRfq(row: Row): AdminRfqRow {
    return {
      id: row.id,
      title: row.title,
      status: row.status as RfqStatus,
      buyer: party(row.buyer_id, row.buyer_name),
      deadline: iso(row.deadline),
      publishedAt: iso(row.published_at),
      createdAt: iso(row.created_at)!,
      suppliersCount: Number(row.suppliers_count),
      respondedCount: Number(row.responded_count),
      quotesCount: Number(row.quotes_count),
      attention: (row.attention as RfqAttentionFlag | null) ?? null,
    }
  }

  private presentQuote(row: Row): AdminQuoteRow {
    return {
      id: row.id,
      rfqId: row.rfq_id,
      rfqTitle: row.rfq_title,
      status: row.status as QuoteStatus,
      buyer: party(row.buyer_id, row.buyer_name),
      supplier: party(row.supplier_id, row.supplier_name),
      totalAmount: row.total_amount,
      currency: row.currency,
      submittedAt: iso(row.submitted_at),
      validUntil: iso(row.valid_until),
      createdAt: iso(row.created_at)!,
    }
  }

  private presentOrder(row: Row): AdminOrderRow {
    return {
      id: row.id,
      quoteId: row.quote_id,
      status: row.status as OrderStatus,
      buyer: party(row.buyer_id, row.buyer_name),
      supplier: party(row.supplier_id, row.supplier_name),
      totalAmount: row.total_amount,
      currency: row.currency,
      createdAt: iso(row.created_at)!,
    }
  }
}
