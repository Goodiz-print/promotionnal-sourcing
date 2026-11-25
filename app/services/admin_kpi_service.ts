import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import AdminAgencyReviewService from '#services/admin_agency_review_service'
import {
  ADMIN_KPI_DEFAULT_DAYS,
  ADMIN_KPI_MAX_DAYS,
  type AdminKpiFilters,
  type AdminKpiPeriod,
  type AdminKpiReport,
  type KpiAmount,
  type KpiDailyRow,
  type KpiMetric,
} from '#shared/types/admin_kpi'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'
import type { OrganizationKind } from '#shared/types/organization'
import type { ProductLifecycleStatus } from '#shared/types/product'
import type { RfqStatus } from '#shared/types/rfq'

/** Bornes d'une plage : `start` inclus, `end` exclu (SQL). */
interface Range {
  start: string
  end: string
}

/** Indicateurs bruts d'une plage ; comparés entre la période et la précédente. */
interface RangeMetrics {
  newOrganizations: number
  newUsers: number
  activeUsers: number
  rfqsCreated: number
  rfqsPublished: number
  publicationDelayHours: number | null
  supplierResponseRate: number | null
  supplierDeclineRate: number | null
  quotesSubmitted: number
  quotesAccepted: number
  quotesRejected: number
  decisionDelayHours: number | null
  ordersCreated: number
  quoteToOrderRate: number | null
  deliveryDelayHours: number | null
  gmv: Record<string, number>
}

type Metrics = Record<Exclude<keyof RangeMetrics, 'gmv'>, number | null>

/**
 * Indicateurs du tableau de bord KPI (#174). Lecture seule : toutes les
 * agrégations vivent ici, le contrôleur ne fait que transmettre la période.
 * Les valeurs sont calculées à la demande (la période est plafonnée à
 * `ADMIN_KPI_MAX_DAYS` et les colonnes filtrées sont indexées ou bornées).
 */
@inject()
export default class AdminKpiService {
  constructor(private agencyReviews: AdminAgencyReviewService) {}

  defaultFilters(now: DateTime = DateTime.now()): AdminKpiFilters {
    return {
      from: now.minus({ days: ADMIN_KPI_DEFAULT_DAYS - 1 }).toISODate()!,
      to: now.toISODate()!,
    }
  }

  /**
   * Complète la période reçue (dates déjà validées) : fin = aujourd'hui par
   * défaut, début déduit de la fin, durée plafonnée à `ADMIN_KPI_MAX_DAYS` (on
   * garde la fin). Une fin dans le futur est ramenée à aujourd'hui.
   */
  resolveFilters(query: { from?: DateTime; to?: DateTime }): AdminKpiFilters {
    const today = DateTime.now().startOf('day')
    let end = query.to?.startOf('day') ?? today
    if (end > today) end = today
    let from = query.from?.startOf('day') ?? end.minus({ days: ADMIN_KPI_DEFAULT_DAYS - 1 })
    if (from > end) from = end
    const earliest = end.minus({ days: ADMIN_KPI_MAX_DAYS - 1 })
    if (from < earliest) from = earliest
    return { from: from.toISODate()!, to: end.toISODate()! }
  }

  /** Période précédente : même durée, juste avant le début. */
  period(filters: AdminKpiFilters): AdminKpiPeriod {
    const from = DateTime.fromISO(filters.from)
    const to = DateTime.fromISO(filters.to)
    const days = Math.round(to.diff(from, 'days').days) + 1
    return {
      ...filters,
      previousFrom: from.minus({ days }).toISODate()!,
      previousTo: from.minus({ days: 1 }).toISODate()!,
    }
  }

  async report(filters: AdminKpiFilters): Promise<AdminKpiReport> {
    const period = this.period(filters)
    const current = this.range(period.from, period.to)
    const previous = this.range(period.previousFrom, period.previousTo)

    const [now, before, organizationsByType, rfqStatuses, catalogue, agencyReviews, daily] =
      await Promise.all([
        this.metrics(current),
        this.metrics(previous),
        this.organizationsByType(current),
        this.rfqsByStatus(current),
        this.catalogue(),
        this.agencyReviews.openCount(),
        this.daily(period),
      ])

    const metric = (key: keyof Metrics): KpiMetric => ({
      current: now[key],
      previous: before[key],
    })

    return {
      period,
      accounts: {
        newOrganizations: metric('newOrganizations'),
        newUsers: metric('newUsers'),
        activeUsers: metric('activeUsers'),
        organizationsByType,
      },
      rfqs: {
        created: metric('rfqsCreated'),
        published: metric('rfqsPublished'),
        publicationDelayHours: metric('publicationDelayHours'),
        supplierResponseRate: metric('supplierResponseRate'),
        supplierDeclineRate: metric('supplierDeclineRate'),
        byStatus: rfqStatuses,
      },
      quotes: {
        submitted: metric('quotesSubmitted'),
        accepted: metric('quotesAccepted'),
        rejected: metric('quotesRejected'),
        decisionDelayHours: metric('decisionDelayHours'),
      },
      orders: {
        created: metric('ordersCreated'),
        quoteToOrderRate: metric('quoteToOrderRate'),
        deliveryDelayHours: metric('deliveryDelayHours'),
        gmv: this.amounts(now.gmv, before.gmv),
      },
      catalogue,
      toHandle: { agencyReviews },
      daily,
    }
  }

  private zone(): string {
    return DateTime.local().zoneName ?? 'UTC'
  }

  private range(from: string, to: string): Range {
    return {
      start: DateTime.fromISO(from).startOf('day').toSQL()!,
      end: DateTime.fromISO(to).plus({ days: 1 }).startOf('day').toSQL()!,
    }
  }

  private between(query: ReturnType<typeof db.from>, column: string, range: Range) {
    return query.where(column, '>=', range.start).where(column, '<', range.end)
  }

  private async metrics(range: Range): Promise<RangeMetrics> {
    const count = async (
      table: string,
      column: string,
      extra?: (q: ReturnType<typeof db.from>) => void
    ) => {
      const query = this.between(db.from(table), column, range)
      extra?.(query)
      const row = await query.count('* as total').first()
      return Number(row?.total ?? 0)
    }
    const hours = (sql: string) =>
      db.raw(`round((extract(epoch from avg(${sql})) / 3600)::numeric, 1)::float as hours`)

    const [
      newOrganizations,
      newUsers,
      activeUsers,
      rfqsCreated,
      rfqsPublished,
      publication,
      suppliers,
      quotesSubmitted,
      quotesAccepted,
      quotesRejected,
      decision,
      ordersCreated,
      converted,
      delivery,
      gmv,
    ] = await Promise.all([
      count('organizations', 'created_at'),
      count('users', 'created_at'),
      count('users', 'last_login_at'),
      count('rfqs', 'created_at'),
      count('rfqs', 'published_at'),
      this.between(db.from('rfqs'), 'published_at', range)
        .select(hours('published_at - created_at'))
        .first(),
      this.between(db.from('rfq_suppliers'), 'sent_at', range)
        .whereIn('status', ['sent', 'viewed', 'responded', 'declined', 'expired'])
        .select(
          db.raw('count(*)::int as total'),
          db.raw("count(*) filter (where status = 'responded')::int as responded"),
          db.raw("count(*) filter (where status = 'declined')::int as declined")
        )
        .first(),
      count('quotes', 'submitted_at'),
      count('quotes', 'decided_at', (q) => q.where('status', 'accepted')),
      count('quotes', 'decided_at', (q) => q.where('status', 'rejected')),
      this.between(db.from('quotes'), 'decided_at', range)
        .whereIn('status', ['accepted', 'rejected'])
        .whereNotNull('submitted_at')
        .select(hours('decided_at - submitted_at'))
        .first(),
      count('orders', 'created_at'),
      this.between(db.from('quotes as q'), 'q.submitted_at', range)
        .whereExists(db.from('orders as o').whereRaw('o.quote_id = q.id'))
        .count('* as total')
        .first(),
      this.between(db.from('orders'), 'delivered_at', range)
        .select(hours('delivered_at - created_at'))
        .first(),
      this.between(db.from('orders'), 'created_at', range)
        .whereNot('status', 'cancelled')
        .select('currency', db.raw('sum(total_amount)::float as amount'))
        .groupBy('currency'),
    ])

    const notified = Number(suppliers?.total ?? 0)
    return {
      newOrganizations,
      newUsers,
      activeUsers,
      rfqsCreated,
      rfqsPublished,
      publicationDelayHours: publication?.hours ?? null,
      supplierResponseRate: notified ? Number(suppliers?.responded ?? 0) / notified : null,
      supplierDeclineRate: notified ? Number(suppliers?.declined ?? 0) / notified : null,
      quotesSubmitted,
      quotesAccepted,
      quotesRejected,
      decisionDelayHours: decision?.hours ?? null,
      ordersCreated,
      quoteToOrderRate: quotesSubmitted ? Number(converted?.total ?? 0) / quotesSubmitted : null,
      deliveryDelayHours: delivery?.hours ?? null,
      gmv: Object.fromEntries(gmv.map((row) => [String(row.currency), Number(row.amount)])),
    }
  }

  /** Une ligne par devise présente sur l'une des deux périodes. */
  private amounts(now: Record<string, number>, before: Record<string, number>): KpiAmount[] {
    return [...new Set([...Object.keys(now), ...Object.keys(before)])].sort().map((currency) => ({
      currency,
      current: now[currency] ?? 0,
      previous: before[currency] ?? 0,
    }))
  }

  private async organizationsByType(range: Range) {
    const rows = await this.between(db.from('organizations'), 'created_at', range)
      .select('organization_type', db.raw('count(*)::int as total'))
      .groupBy('organization_type')
      .orderBy('organization_type')
    return rows.map((row) => ({
      type: row.organization_type as OrganizationKind,
      count: Number(row.total),
    }))
  }

  private async rfqsByStatus(range: Range) {
    const rows = await this.between(db.from('rfqs'), 'created_at', range)
      .select('status', db.raw('count(*)::int as total'))
      .groupBy('status')
      .orderBy('status')
    return rows.map((row) => ({ status: row.status as RfqStatus, count: Number(row.total) }))
  }

  private async catalogue(): Promise<AdminKpiReport['catalogue']> {
    const [lifecycle, translations] = await Promise.all([
      db
        .from('products')
        .select('lifecycle_status', db.raw('count(*)::int as total'))
        .groupBy('lifecycle_status')
        .orderBy('lifecycle_status'),
      db
        .from('product_translations')
        .whereIn('locale', [...SUPPORTED_LOCALES])
        .select('locale', db.raw('count(distinct product_id)::int as total'))
        .groupBy('locale'),
    ])

    const byLifecycle = lifecycle.map((row) => ({
      status: row.lifecycle_status as ProductLifecycleStatus,
      count: Number(row.total),
    }))
    const products = byLifecycle.reduce((sum, row) => sum + row.count, 0)
    const translated = new Map(translations.map((row) => [String(row.locale), Number(row.total)]))

    return {
      products,
      byLifecycle,
      translationCoverage: SUPPORTED_LOCALES.map((locale) => ({
        locale,
        rate: products ? (translated.get(locale) ?? 0) / products : 0,
      })),
    }
  }

  /** Une ligne par jour de la période (les jours sans activité valent 0). */
  private async daily(period: AdminKpiPeriod): Promise<KpiDailyRow[]> {
    const range = this.range(period.from, period.to)
    const series: [keyof Omit<KpiDailyRow, 'day'>, string, string][] = [
      ['organizations', 'organizations', 'created_at'],
      ['users', 'users', 'created_at'],
      ['rfqs', 'rfqs', 'published_at'],
      ['quotes', 'quotes', 'submitted_at'],
      ['orders', 'orders', 'created_at'],
    ]

    const rows = new Map<string, KpiDailyRow>()
    const first = DateTime.fromISO(period.from)
    const days = Math.round(DateTime.fromISO(period.to).diff(first, 'days').days) + 1
    for (let offset = 0; offset < days; offset++) {
      const day = first.plus({ days: offset }).toISODate()!
      rows.set(day, { day, organizations: 0, users: 0, rfqs: 0, quotes: 0, orders: 0 })
    }

    const results = await Promise.all(
      series.map(([, table, column]) =>
        this.between(db.from(table), column, range)
          .select(
            db.raw(`to_char(${column} at time zone ?, 'YYYY-MM-DD') as day`, [this.zone()]),
            db.raw('count(*)::int as total')
          )
          .groupBy('day')
      )
    )
    results.forEach((result, index) => {
      const key = series[index][0]
      for (const row of result) {
        const target = rows.get(String(row.day))
        if (target) target[key] = Number(row.total)
      }
    })

    return [...rows.values()]
  }
}
