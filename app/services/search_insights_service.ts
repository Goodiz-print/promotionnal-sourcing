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

/** Fuseau des bornes de jour. */
const TIMEZONE = 'Europe/Paris'

/** Bornes (UTC) d'une période, incluses. */
interface Range {
  from: DateTime
  to: DateTime
}

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
    const { from, to } = filters

    // Bornes de la période en UTC (jours inclus, en fuseau Europe/Paris)
    const fromDate = DateTime.fromISO(from, { zone: TIMEZONE }).startOf('day').toUTC()
    const toDate = DateTime.fromISO(to, { zone: TIMEZONE }).endOf('day').toUTC()

    // Période précédente de même durée
    const days = Math.ceil(toDate.diff(fromDate, 'days').days)
    const prevFromDate = fromDate.minus({ days })
    const prevToDate = fromDate.minus({ milliseconds: 1 })

    const range: Range = { from: fromDate, to: toDate }
    const prevRange: Range = { from: prevFromDate, to: prevToDate }

    const summaryRow = await this.scoped(range, filters)
      .select(
        db.raw('COUNT(*)::int AS total'),
        db.raw('COALESCE(SUM(CASE WHEN zero_results THEN 1 ELSE 0 END), 0)::int AS zero_results')
      )
      .first()
    const total = Number(summaryRow?.total ?? 0)
    const zeroResults = Number(summaryRow?.zero_results ?? 0)

    const modeRows = await this.scoped(range, filters)
      .select('mode')
      .count('* as count')
      .groupBy('mode')
    const byMode = Object.fromEntries(SEARCH_EVENT_MODES.map((mode) => [mode, 0])) as Record<
      SearchEventMode,
      number
    >
    for (const row of modeRows) byMode[row.mode as SearchEventMode] = Number(row.count)

    const previous = await this.scoped(prevRange, filters).count('* as count').first()

    const summary: SearchInsightsSummary = {
      total,
      zeroResults,
      zeroRate: total > 0 ? zeroResults / total : 0,
      byMode,
      previousTotal: Number(previous?.count ?? 0),
    }

    const [
      topQueries,
      zeroResultQueries,
      daily,
      topCategories,
      topFilters,
      topProducts,
      topSuppliers,
    ] = await Promise.all([
      this.fetchQueryRows(range, filters, false),
      this.fetchQueryRows(range, filters, true),
      this.fetchDailySeries(range, filters),
      this.fetchTopCategories(range, filters, adminLocale),
      this.fetchTopFilters(range, filters),
      this.fetchTopTargets(range, filters, 'product', adminLocale),
      this.fetchTopTargets(range, filters, 'supplier', adminLocale),
    ])

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

  /** `search_events` de la période, avec les filtres source / langue / type d'organisation. */
  private scoped(range: Range, filters: SearchInsightsFilters) {
    return db
      .from('search_events')
      .where('created_at', '>=', range.from.toJSDate())
      .where('created_at', '<=', range.to.toJSDate())
      .if(filters.source, (q) => q.where('source', filters.source!))
      .if(filters.locale, (q) => q.where('locale', filters.locale!))
      .if(filters.organizationType, (q) =>
        q.whereIn('organization_id', this.organizationsOfType(filters.organizationType!))
      )
  }

  private organizationsOfType(type: string) {
    return db.from('organizations').select('id').where('organization_type', type)
  }

  /** Classement des termes (tous, ou seulement les recherches sans résultat). */
  private async fetchQueryRows(
    range: Range,
    filters: SearchInsightsFilters,
    zeroResultsOnly: boolean
  ): Promise<SearchInsightsQueryRow[]> {
    const rows = await this.scoped(range, filters)
      .whereNotNull('query')
      .if(zeroResultsOnly, (q) => q.where('zero_results', true))
      .select(
        'query',
        db.raw('COUNT(*)::int AS count'),
        db.raw('COALESCE(SUM(CASE WHEN zero_results THEN 1 ELSE 0 END), 0)::int AS zero_count'),
        db.raw('ROUND(AVG(results_count))::int AS avg_results')
      )
      .groupBy('query')
      .orderBy('count', 'desc')
      .orderBy('query', 'asc')
      .limit(SEARCH_INSIGHTS_TOP_LIMIT)

    return rows.map((row) => ({
      query: row.query as string,
      count: Number(row.count),
      zeroCount: Number(row.zero_count),
      avgResults: Number(row.avg_results ?? 0),
    }))
  }

  /** Série complète jour par jour (Europe/Paris), jours sans recherche compris. */
  private async fetchDailySeries(
    range: Range,
    filters: SearchInsightsFilters
  ): Promise<SearchInsightsDayPoint[]> {
    const dayExpr = `to_char(created_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD')`
    const rows = await this.scoped(range, filters)
      .select(
        db.raw(`${dayExpr} AS day`),
        db.raw('COUNT(*)::int AS total'),
        db.raw('COALESCE(SUM(CASE WHEN zero_results THEN 1 ELSE 0 END), 0)::int AS zero_results')
      )
      .groupByRaw(dayExpr)

    const byDay = new Map<string, { total: number; zeroResults: number }>()
    for (const row of rows) {
      byDay.set(String(row.day), {
        total: Number(row.total),
        zeroResults: Number(row.zero_results),
      })
    }

    const result: SearchInsightsDayPoint[] = []
    const end = DateTime.fromISO(filters.to, { zone: TIMEZONE })
    for (
      let day = DateTime.fromISO(filters.from, { zone: TIMEZONE });
      day <= end;
      day = day.plus({ days: 1 })
    ) {
      const date = day.toFormat('yyyy-MM-dd')
      result.push({
        date,
        total: byDay.get(date)?.total ?? 0,
        zeroResults: byDay.get(date)?.zeroResults ?? 0,
      })
    }
    return result
  }

  /** Catégories les plus recherchées, avec leur nom dans la langue de l'admin. */
  private async fetchTopCategories(
    range: Range,
    filters: SearchInsightsFilters,
    adminLocale: string
  ): Promise<SearchInsightsCategoryRow[]> {
    const rows = await this.scoped(range, filters)
      .whereNotNull('category_id')
      .select('category_id')
      .count('* as count')
      .groupBy('category_id')
      .orderBy('count', 'desc')
      .orderBy('category_id', 'asc')
      .limit(SEARCH_INSIGHTS_TOP_LIMIT)
    if (rows.length === 0) return []

    const names = await this.translatedNames(
      'category_translations',
      'category_id',
      rows.map((row) => row.category_id as number),
      adminLocale
    )
    return rows.map((row) => ({
      categoryId: row.category_id as number,
      name: names.get(row.category_id as number) ?? `Category ${row.category_id}`,
      count: Number(row.count),
    }))
  }

  /** Clés de filtre les plus utilisées (colonne jsonb `filters`). */
  private async fetchTopFilters(
    range: Range,
    filters: SearchInsightsFilters
  ): Promise<SearchInsightsFilterRow[]> {
    const keys = this.scoped(range, filters)
      .whereRaw(`filters <> '{}'::jsonb`)
      .select(db.raw('jsonb_object_keys(filters) AS key'))
      .as('keys')

    const result = await db
      .from(keys)
      .select('key')
      .count('* as count')
      .groupBy('key')
      .orderBy('count', 'desc')
      .orderBy('key', 'asc')
      .limit(SEARCH_INSIGHTS_TOP_LIMIT)

    return result.map((row) => ({ key: row.key as string, count: Number(row.count) }))
  }

  /** Produits ou fournisseurs les plus consultés (`activity_events`), avec ajouts RFQ. */
  private async fetchTopTargets(
    range: Range,
    filters: SearchInsightsFilters,
    targetType: 'product' | 'supplier',
    adminLocale: string
  ): Promise<SearchInsightsTargetRow[]> {
    const events = (type: string) =>
      db
        .from('activity_events')
        .where('created_at', '>=', range.from.toJSDate())
        .where('created_at', '<=', range.to.toJSDate())
        .where('target_type', targetType)
        .where('type', type)
        .if(filters.organizationType, (q) =>
          q.whereIn('organization_id', this.organizationsOfType(filters.organizationType!))
        )

    const viewRows = await events(targetType === 'product' ? 'product_viewed' : 'supplier_viewed')
      .select('target_id')
      .count('* as views')
      .groupBy('target_id')
      .orderBy('views', 'desc')
      .orderBy('target_id', 'asc')
      .limit(SEARCH_INSIGHTS_TOP_LIMIT)
    if (viewRows.length === 0) return []

    const ids = viewRows.map((row) => row.target_id as number)

    const rfqAdds = new Map<number, number>()
    if (targetType === 'product') {
      const addRows = await events('rfq_product_added')
        .whereIn('target_id', ids)
        .select('target_id')
        .count('* as adds')
        .groupBy('target_id')
      for (const row of addRows) rfqAdds.set(row.target_id as number, Number(row.adds))
    }

    const names = await this.translatedNames(
      targetType === 'product' ? 'product_translations' : 'supplier_translations',
      targetType === 'product' ? 'product_id' : 'supplier_id',
      ids,
      adminLocale
    )
    return viewRows.map((row) => ({
      targetId: row.target_id as number,
      name: names.get(row.target_id as number) ?? `${targetType} ${row.target_id}`,
      views: Number(row.views),
      rfqAdds: rfqAdds.get(row.target_id as number) ?? 0,
    }))
  }

  /** Noms traduits (une requête), repli de `resolveTranslation` si la langue manque. */
  private async translatedNames(
    table: string,
    foreignKey: string,
    ids: number[],
    adminLocale: string
  ): Promise<Map<number, string>> {
    const rows = await db.from(table).whereIn(foreignKey, ids).select(foreignKey, 'locale', 'name')
    const grouped = new Map<number, { locale: string; name: string }[]>()
    for (const row of rows) {
      const id = row[foreignKey] as number
      grouped.set(id, [...(grouped.get(id) ?? []), { locale: row.locale, name: row.name }])
    }
    const names = new Map<number, string>()
    for (const [id, translations] of grouped) {
      const resolved = resolveTranslation(translations, adminLocale)
      if (resolved) names.set(id, resolved.name)
    }
    return names
  }
}
