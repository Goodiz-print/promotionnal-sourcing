import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { resolveTranslation } from '#shared/helpers/translations'
import {
  SEARCH_INSIGHTS_TOP_LIMIT,
  type SearchInsightsFilters,
  type SearchInsightsReport,
  type SearchInsightsSummary,
  type SearchInsightsQueryRow,
  type SearchInsightsDayPoint,
  type SearchInsightsCategoryRow,
  type SearchInsightsFilterRow,
  type SearchInsightsTargetRow,
} from '#shared/types/search_insights'
import { SEARCH_EVENT_MODES, type SearchEventMode } from '#shared/types/search_event'

/** Paris timezone for day boundaries. */
const TIMEZONE = 'Europe/Paris'

/**
 * Agrégation des journaux `search_events` et `activity_events` pour l'écran
 * admin « Ce que cherchent les clients » (#173).
 */
export default class SearchInsightsService {
  /**
   * Génère le rapport complet pour les filtres donnés.
   *
   * @param filters Filtres de l'écran (période, source, locale, type d'org)
   * @param adminLocale Langue de l'admin pour les noms traduits (catégories, produits, fournisseurs)
   */
  async report(filters: SearchInsightsFilters, adminLocale: string): Promise<SearchInsightsReport> {
    const { from, to, source, locale, organizationType } = filters

    // Bornes de la période en UTC (jours inclus, en fuseau Europe/Paris)
    const fromDate = DateTime.fromISO(from, { zone: TIMEZONE }).startOf('day').toUTC()
    const toDate = DateTime.fromISO(to, { zone: TIMEZONE }).endOf('day').toUTC()

    // Période précédente de même durée
    const days = Math.ceil(toDate.diff(fromDate, 'days').days)
    const prevFromDate = fromDate.minus({ days })
    const prevToDate = fromDate.minus({ milliseconds: 1 })

    // 1. Summary
    const summaryData = await db
      .from('search_events')
      .where('created_at', '>=', fromDate.toJSDate())
      .where('created_at', '<=', toDate.toJSDate())
      .if(source, (q) => q.where('source', source!))
      .if(locale, (q) => q.where('locale', locale!))
      .if(organizationType, (q) =>
        q.whereIn(
          'organization_id',
          db.from('organizations').select('id').where('organization_type', organizationType!)
        )
      )
      .select(
        db.raw('COUNT(*)::int AS total'),
        db.raw('SUM(CASE WHEN zero_results THEN 1 ELSE 0 END)::int AS zero_results')
      )
      .first()

    const total = summaryData?.total ?? 0
    const zeroResults = summaryData?.zero_results ?? 0

    // Count by mode
    const modeRows = await db
      .from('search_events')
      .where('created_at', '>=', fromDate.toJSDate())
      .where('created_at', '<=', toDate.toJSDate())
      .if(source, (q) => q.where('source', source!))
      .if(locale, (q) => q.where('locale', locale!))
      .if(organizationType, (q) =>
        q.whereIn(
          'organization_id',
          db.from('organizations').select('id').where('organization_type', organizationType!)
        )
      )
      .select('mode')
      .count('* as count')
      .groupBy('mode')

    const byMode = SEARCH_EVENT_MODES.reduce(
      (acc, mode) => {
        acc[mode] = 0
        return acc
      },
      {} as Record<SearchEventMode, number>
    )
    for (const row of modeRows) {
      byMode[row.mode as SearchEventMode] = Number(row.count)
    }

    // Previous period total
    const prevData = await db
      .from('search_events')
      .where('created_at', '>=', prevFromDate.toJSDate())
      .where('created_at', '<=', prevToDate.toJSDate())
      .if(source, (q) => q.where('source', source!))
      .if(locale, (q) => q.where('locale', locale!))
      .if(organizationType, (q) =>
        q.whereIn(
          'organization_id',
          db.from('organizations').select('id').where('organization_type', organizationType!)
        )
      )
      .count('* as count')
      .first()

    const previousTotal = Number(prevData?.count ?? 0)

    const summary: SearchInsightsSummary = {
      total,
      zeroResults,
      zeroRate: total > 0 ? zeroResults / total : 0,
      byMode,
      previousTotal,
    }

    // 2. Top queries (query non null)
    const topQueries = await this.fetchQueryRows(
      fromDate,
      toDate,
      source,
      locale,
      organizationType,
      false
    )

    // 3. Zero result queries (zero_results = true, query non null)
    const zeroResultQueries = await this.fetchQueryRows(
      fromDate,
      toDate,
      source,
      locale,
      organizationType,
      true
    )

    // 4. Daily series
    const daily = await this.fetchDailySeries(
      fromDate,
      toDate,
      source,
      locale,
      organizationType,
      from,
      to
    )

    // 5. Top categories
    const topCategories = await this.fetchTopCategories(
      fromDate,
      toDate,
      source,
      locale,
      organizationType,
      adminLocale
    )

    // 6. Top filters
    const topFilters = await this.fetchTopFilters(
      fromDate,
      toDate,
      source,
      locale,
      organizationType
    )

    // 7. Top products (views + rfqAdds)
    const topProducts = await this.fetchTopTargets(
      fromDate,
      toDate,
      organizationType,
      'product',
      adminLocale
    )

    // 8. Top suppliers (views only)
    const topSuppliers = await this.fetchTopTargets(
      fromDate,
      toDate,
      organizationType,
      'supplier',
      adminLocale
    )

    return {
      filters,
      summary,
      topQueries,
      zeroResultQueries,
      daily,
      topCategories,
      topFilters,
      topProducts,
      topSuppliers,
    }
  }

  /**
   * Exporte les données en CSV.
   */
  async exportCsv(filters: SearchInsightsFilters, adminLocale: string): Promise<string> {
    const report = await this.report(filters, adminLocale)

    const lines: string[] = []

    // BOM UTF-8
    const BOM = '﻿'

    // Summary section
    lines.push('Section,Metric,Value')
    lines.push(`Summary,Total Searches,${report.summary.total}`)
    lines.push(`Summary,Zero Results,${report.summary.zeroResults}`)
    lines.push(`Summary,Zero Rate,${(report.summary.zeroRate * 100).toFixed(2)}%`)
    lines.push(`Summary,Previous Period Total,${report.summary.previousTotal}`)
    for (const mode of SEARCH_EVENT_MODES) {
      lines.push(`Summary,Mode ${mode},${report.summary.byMode[mode]}`)
    }
    lines.push('')

    // Top queries
    lines.push('Top Queries')
    lines.push('Query,Count,Zero Count,Avg Results')
    for (const row of report.topQueries) {
      lines.push(`${this.escapeCsvCell(row.query)},${row.count},${row.zeroCount},${row.avgResults}`)
    }
    lines.push('')

    // Zero result queries
    lines.push('Zero Result Queries')
    lines.push('Query,Count,Zero Count,Avg Results')
    for (const row of report.zeroResultQueries) {
      lines.push(`${this.escapeCsvCell(row.query)},${row.count},${row.zeroCount},${row.avgResults}`)
    }
    lines.push('')

    // Daily
    lines.push('Daily')
    lines.push('Date,Total,Zero Results')
    for (const row of report.daily) {
      lines.push(`${row.date},${row.total},${row.zeroResults}`)
    }
    lines.push('')

    // Top categories
    lines.push('Top Categories')
    lines.push('Category ID,Name,Count')
    for (const row of report.topCategories) {
      lines.push(`${row.categoryId},${this.escapeCsvCell(row.name)},${row.count}`)
    }
    lines.push('')

    // Top filters
    lines.push('Top Filters')
    lines.push('Key,Count')
    for (const row of report.topFilters) {
      lines.push(`${this.escapeCsvCell(row.key)},${row.count}`)
    }
    lines.push('')

    // Top products
    lines.push('Top Products')
    lines.push('Product ID,Name,Views,RFQ Adds')
    for (const row of report.topProducts) {
      lines.push(`${row.targetId},${this.escapeCsvCell(row.name)},${row.views},${row.rfqAdds}`)
    }
    lines.push('')

    // Top suppliers
    lines.push('Top Suppliers')
    lines.push('Supplier ID,Name,Views,RFQ Adds')
    for (const row of report.topSuppliers) {
      lines.push(`${row.targetId},${this.escapeCsvCell(row.name)},${row.views},${row.rfqAdds}`)
    }

    return BOM + lines.join('\r\n')
  }

  /**
   * Escape CSV cell with double quotes and formula injection protection.
   * Prefixes cells starting with =, +, -, @ with an apostrophe.
   */
  private escapeCsvCell(value: string): string {
    let escaped = value
    // Protect against formula injection
    if (/^[=+\-@]/.test(escaped)) {
      escaped = "'" + escaped
    }
    // Escape double quotes and wrap in quotes if needed
    if (escaped.includes('"') || escaped.includes(',') || escaped.includes('\n')) {
      escaped = '"' + escaped.replace(/"/g, '""') + '"'
    }
    return escaped
  }

  /**
   * Fetch top queries or zero-result queries.
   */
  private async fetchQueryRows(
    fromDate: DateTime,
    toDate: DateTime,
    source: string | null,
    locale: string | null,
    organizationType: string | null,
    zeroResultsOnly: boolean
  ): Promise<SearchInsightsQueryRow[]> {
    const rows = await db
      .from('search_events')
      .where('created_at', '>=', fromDate.toJSDate())
      .where('created_at', '<=', toDate.toJSDate())
      .whereNotNull('query')
      .if(source, (q) => q.where('source', source!))
      .if(locale, (q) => q.where('locale', locale!))
      .if(organizationType, (q) =>
        q.whereIn(
          'organization_id',
          db.from('organizations').select('id').where('organization_type', organizationType!)
        )
      )
      .if(zeroResultsOnly, (q) => q.where('zero_results', true))
      .select('query')
      .count('* as count')
      .sum({ zero_count: db.raw('CASE WHEN zero_results THEN 1 ELSE 0 END') })
      .avg({ avg_results: 'results_count' })
      .groupBy('query')
      .orderBy('count', 'desc')
      .limit(SEARCH_INSIGHTS_TOP_LIMIT)

    return rows.map((row) => ({
      query: row.query as string,
      count: Number(row.count),
      zeroCount: Number(row.zero_count ?? 0),
      avgResults: Math.round(Number(row.avg_results ?? 0)),
    }))
  }

  /**
   * Generate daily series (complete, including days with 0 searches).
   */
  private async fetchDailySeries(
    fromDate: DateTime,
    toDate: DateTime,
    source: string | null,
    locale: string | null,
    organizationType: string | null,
    fromISO: string,
    toISO: string
  ): Promise<SearchInsightsDayPoint[]> {
    // Fetch actual data
    const rows = await db
      .from('search_events')
      .where('created_at', '>=', fromDate.toJSDate())
      .where('created_at', '<=', toDate.toJSDate())
      .if(source, (q) => q.where('source', source!))
      .if(locale, (q) => q.where('locale', locale!))
      .if(organizationType, (q) =>
        q.whereIn(
          'organization_id',
          db.from('organizations').select('id').where('organization_type', organizationType!)
        )
      )
      .select(
        db.raw(`DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris') as date`),
        db.raw('COUNT(*)::int as total'),
        db.raw('SUM(CASE WHEN zero_results THEN 1 ELSE 0 END)::int as zero_results')
      )
      .groupBy('date')
      .orderBy('date', 'asc')

    const dataMap = new Map<string, { total: number; zeroResults: number }>()
    for (const row of rows) {
      const dateStr =
        row.date instanceof Date
          ? DateTime.fromJSDate(row.date).toFormat('yyyy-MM-dd')
          : String(row.date)
      dataMap.set(dateStr, {
        total: row.total,
        zeroResults: row.zero_results,
      })
    }

    // Generate complete series
    const result: SearchInsightsDayPoint[] = []
    let current = DateTime.fromISO(fromISO, { zone: TIMEZONE })
    const end = DateTime.fromISO(toISO, { zone: TIMEZONE })

    while (current <= end) {
      const dateStr = current.toFormat('yyyy-MM-dd')
      const data = dataMap.get(dateStr)
      result.push({
        date: dateStr,
        total: data?.total ?? 0,
        zeroResults: data?.zeroResults ?? 0,
      })
      current = current.plus({ days: 1 })
    }

    return result
  }

  /**
   * Fetch top categories with translated names.
   */
  private async fetchTopCategories(
    fromDate: DateTime,
    toDate: DateTime,
    source: string | null,
    locale: string | null,
    organizationType: string | null,
    adminLocale: string
  ): Promise<SearchInsightsCategoryRow[]> {
    const rows = await db
      .from('search_events')
      .where('created_at', '>=', fromDate.toJSDate())
      .where('created_at', '<=', toDate.toJSDate())
      .whereNotNull('category_id')
      .if(source, (q) => q.where('source', source!))
      .if(locale, (q) => q.where('locale', locale!))
      .if(organizationType, (q) =>
        q.whereIn(
          'organization_id',
          db.from('organizations').select('id').where('organization_type', organizationType!)
        )
      )
      .select('category_id')
      .count('* as count')
      .groupBy('category_id')
      .orderBy('count', 'desc')
      .limit(SEARCH_INSIGHTS_TOP_LIMIT)

    if (rows.length === 0) return []

    // Fetch category translations in one query
    const categoryIds = rows.map((r) => r.category_id)
    const translations = await db
      .from('category_translations')
      .whereIn('category_id', categoryIds)
      .select('category_id', 'locale', 'name')

    // Group translations by category_id
    const translationsByCategory = new Map<number, { locale: string; name: string }[]>()
    for (const t of translations) {
      if (!translationsByCategory.has(t.category_id)) {
        translationsByCategory.set(t.category_id, [])
      }
      translationsByCategory.get(t.category_id)!.push({ locale: t.locale, name: t.name })
    }

    return rows.map((row) => {
      const catTranslations = translationsByCategory.get(row.category_id) ?? []
      const resolved = resolveTranslation(catTranslations, adminLocale)
      return {
        categoryId: row.category_id as number,
        name: resolved?.name ?? `Category ${row.category_id}`,
        count: Number(row.count),
      }
    })
  }

  /**
   * Fetch top filter keys from jsonb filters column.
   */
  private async fetchTopFilters(
    fromDate: DateTime,
    toDate: DateTime,
    source: string | null,
    locale: string | null,
    organizationType: string | null
  ): Promise<SearchInsightsFilterRow[]> {
    // Build conditions
    const conditions: string[] = ['created_at >= $1', 'created_at <= $2', "filters != '{}'::jsonb"]
    const bindings: (Date | string)[] = [fromDate.toJSDate(), toDate.toJSDate()]
    let paramIndex = 3

    if (source) {
      conditions.push(`source = $${paramIndex}`)
      bindings.push(source)
      paramIndex++
    }
    if (locale) {
      conditions.push(`locale = $${paramIndex}`)
      bindings.push(locale)
      paramIndex++
    }
    if (organizationType) {
      conditions.push(
        `organization_id IN (SELECT id FROM organizations WHERE organization_type = $${paramIndex})`
      )
      bindings.push(organizationType)
    }

    const whereClause = conditions.join(' AND ')

    // Use rawQuery for the subquery with jsonb_object_keys
    const result = await db.rawQuery<{ rows: Array<{ key: string; count: string }> }>(
      `
      SELECT key, COUNT(*)::text as count
      FROM (
        SELECT jsonb_object_keys(filters) as key
        FROM search_events
        WHERE ${whereClause}
      ) as keys
      GROUP BY key
      ORDER BY count DESC
      LIMIT ${SEARCH_INSIGHTS_TOP_LIMIT}
      `,
      bindings
    )

    return result.rows.map((row) => ({
      key: row.key,
      count: Number(row.count),
    }))
  }

  /**
   * Fetch top targets (products or suppliers) from activity_events.
   */
  private async fetchTopTargets(
    fromDate: DateTime,
    toDate: DateTime,
    organizationType: string | null,
    targetType: 'product' | 'supplier',
    adminLocale: string
  ): Promise<SearchInsightsTargetRow[]> {
    const viewType = targetType === 'product' ? 'product_viewed' : 'supplier_viewed'

    // Get views
    let viewsQuery = db
      .from('activity_events')
      .where('created_at', '>=', fromDate.toJSDate())
      .where('created_at', '<=', toDate.toJSDate())
      .where('target_type', targetType)
      .where('type', viewType)

    if (organizationType) {
      viewsQuery = viewsQuery.whereIn(
        'organization_id',
        db.from('organizations').select('id').where('organization_type', organizationType)
      )
    }

    const viewRows = await viewsQuery
      .select('target_id')
      .count('* as views')
      .groupBy('target_id')
      .orderBy('views', 'desc')
      .limit(SEARCH_INSIGHTS_TOP_LIMIT * 2) // Fetch more to account for merging with rfqAdds

    if (viewRows.length === 0) return []

    const targetIds = viewRows.map((r) => r.target_id as number)

    // Get rfq_product_added for products only
    let rfqAddMap = new Map<number, number>()
    if (targetType === 'product') {
      let rfqQuery = db
        .from('activity_events')
        .where('created_at', '>=', fromDate.toJSDate())
        .where('created_at', '<=', toDate.toJSDate())
        .where('target_type', 'product')
        .where('type', 'rfq_product_added')
        .whereIn('target_id', targetIds)

      if (organizationType) {
        rfqQuery = rfqQuery.whereIn(
          'organization_id',
          db.from('organizations').select('id').where('organization_type', organizationType)
        )
      }

      const rfqRows = await rfqQuery.select('target_id').count('* as adds').groupBy('target_id')

      for (const row of rfqRows) {
        rfqAddMap.set(row.target_id as number, Number(row.adds))
      }
    }

    // Fetch translations
    let names: Map<number, string>
    if (targetType === 'product') {
      names = await this.fetchProductNames(targetIds, adminLocale)
    } else {
      names = await this.fetchSupplierNames(targetIds, adminLocale)
    }

    return viewRows.slice(0, SEARCH_INSIGHTS_TOP_LIMIT).map((row) => ({
      targetId: row.target_id as number,
      name: names.get(row.target_id as number) ?? `${targetType} ${row.target_id}`,
      views: Number(row.views),
      rfqAdds: rfqAddMap.get(row.target_id as number) ?? 0,
    }))
  }

  /**
   * Fetch product names with fallback.
   */
  private async fetchProductNames(
    productIds: number[],
    adminLocale: string
  ): Promise<Map<number, string>> {
    const translations = await db
      .from('product_translations')
      .whereIn('product_id', productIds)
      .select('product_id', 'locale', 'name')

    const byProduct = new Map<number, { locale: string; name: string }[]>()
    for (const t of translations) {
      if (!byProduct.has(t.product_id)) {
        byProduct.set(t.product_id, [])
      }
      byProduct.get(t.product_id)!.push({ locale: t.locale, name: t.name })
    }

    const result = new Map<number, string>()
    for (const productId of productIds) {
      const trans = byProduct.get(productId) ?? []
      const resolved = resolveTranslation(trans, adminLocale)
      result.set(productId, resolved?.name ?? `Product ${productId}`)
    }
    return result
  }

  /**
   * Fetch supplier names with fallback.
   */
  private async fetchSupplierNames(
    supplierIds: number[],
    adminLocale: string
  ): Promise<Map<number, string>> {
    const translations = await db
      .from('supplier_translations')
      .whereIn('supplier_id', supplierIds)
      .select('supplier_id', 'locale', 'name')

    const bySupplier = new Map<number, { locale: string; name: string }[]>()
    for (const t of translations) {
      if (!bySupplier.has(t.supplier_id)) {
        bySupplier.set(t.supplier_id, [])
      }
      bySupplier.get(t.supplier_id)!.push({ locale: t.locale, name: t.name })
    }

    const result = new Map<number, string>()
    for (const supplierId of supplierIds) {
      const trans = bySupplier.get(supplierId) ?? []
      const resolved = resolveTranslation(trans, adminLocale)
      result.set(supplierId, resolved?.name ?? `Supplier ${supplierId}`)
    }
    return result
  }
}
