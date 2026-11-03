import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import i18nManager from '@adonisjs/i18n/services/main'
import { resolveTranslation } from '#shared/helpers/translations'
import {
  SEARCH_INSIGHTS_TOP_LIMIT,
  type SearchInsightsFilters,
  type SearchInsightsRange,
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

    const range: SearchInsightsRange = { from: fromDate, to: toDate }
    const prevRange: SearchInsightsRange = { from: prevFromDate, to: prevToDate }

    const [modeRows, previous] = await Promise.all([
      this.scoped(range, filters)
        .select('mode')
        .select(
          db.raw('COUNT(*)::int AS total'),
          db.raw('COALESCE(SUM(CASE WHEN zero_results THEN 1 ELSE 0 END), 0)::int AS zero_results')
        )
        .groupBy('mode'),
      this.scoped(prevRange, filters).count('* as count').first(),
    ])
    const byMode = Object.fromEntries(SEARCH_EVENT_MODES.map((mode) => [mode, 0])) as Record<
      SearchEventMode,
      number
    >
    let total = 0
    let zeroResults = 0
    for (const row of modeRows) {
      byMode[row.mode as SearchEventMode] = Number(row.total)
      total += Number(row.total)
      zeroResults += Number(row.zero_results)
    }

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
   * Exporte le rapport en CSV (UTF-8 avec BOM, CRLF). Les libellés reprennent
   * les textes de l'écran, dans la langue de l'admin.
   */
  async exportCsv(filters: SearchInsightsFilters, adminLocale: string): Promise<string> {
    const report = await this.report(filters, adminLocale)
    const i18n = i18nManager.locale(adminLocale)
    const t = (key: string, data?: Record<string, unknown>) => i18n.t(`admin.search.${key}`, data)
    const { summary } = report

    const lines: string[] = []
    const row = (...cells: (string | number)[]) =>
      lines.push(cells.map((cell) => this.escapeCsvCell(String(cell))).join(','))
    const section = (title: string, ...headers: string[]) => {
      if (lines.length > 0) lines.push('')
      row(title)
      if (headers.length > 0) row(...headers)
    }

    section(t('title'))
    row(t('filters.from'), filters.from)
    row(t('filters.to'), filters.to)
    row(t('summary.total'), summary.total)
    row(t('summary.zeroResults'), summary.zeroResults)
    row(t('summary.zeroRate', { rate: `${(summary.zeroRate * 100).toFixed(2)} %` }))
    row(t('summary.previousTotal'), summary.previousTotal)

    section(t('summary.modes'))
    for (const mode of SEARCH_EVENT_MODES) row(t(`modes.${mode}`), summary.byMode[mode])

    const queryHeaders = [
      t('columns.query'),
      t('columns.searches'),
      t('columns.zeroCount'),
      t('columns.avgResults'),
    ]
    section(t('topQueries.title'), ...queryHeaders)
    for (const r of report.topQueries) row(r.query, r.count, r.zeroCount, r.avgResults)

    section(t('zeroQueries.title'), ...queryHeaders)
    for (const r of report.zeroResultQueries) row(r.query, r.count, r.zeroCount, r.avgResults)

    section(t('chart.title'), t('columns.date'), t('columns.searches'), t('columns.zeroCount'))
    for (const r of report.daily) row(r.date, r.total, r.zeroResults)

    section(t('categories.title'), t('columns.category'), t('columns.searches'))
    for (const r of report.topCategories) row(r.name, r.count)

    section(t('filtersUsed.title'), t('columns.filter'), t('columns.searches'))
    for (const r of report.topFilters) row(r.key, r.count)

    section(t('products.title'), t('columns.product'), t('columns.views'), t('columns.rfqAdds'))
    for (const r of report.topProducts) row(r.name, r.views, r.rfqAdds)

    section(t('suppliers.title'), t('columns.supplier'), t('columns.views'))
    for (const r of report.topSuppliers) row(r.name, r.views)

    return '\uFEFF' + lines.join('\r\n')
  }

  /**
   * Échappe une cellule CSV : neutralise les formules (`= + - @`, tabulation et
   * retour chariot en tête) par une apostrophe, puis met entre guillemets les
   * cellules contenant `"`, `,` ou un saut de ligne.
   */
  private escapeCsvCell(value: string): string {
    let escaped = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    if (/[",\r\n]/.test(escaped)) escaped = `"${escaped.replace(/"/g, '""')}"`
    return escaped
  }

  /** `search_events` de la période, avec les filtres source / langue / type d'organisation. */
  private scoped(range: SearchInsightsRange, filters: SearchInsightsFilters) {
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
    range: SearchInsightsRange,
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
    range: SearchInsightsRange,
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
    range: SearchInsightsRange,
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
    range: SearchInsightsRange,
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
    range: SearchInsightsRange,
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
