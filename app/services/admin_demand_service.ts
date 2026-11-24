import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import ActivityAggregationService from '#services/activity_aggregation_service'
import { dateRangeBounds, trailingDateRange } from '#shared/helpers/activity_event'
import { latestDecisionIsRejectedSql } from '#shared/helpers/moderation'
import {
  ADMIN_DEMAND_DEFAULT_DAYS,
  ADMIN_DEMAND_EXPORT_LIMIT,
  ADMIN_DEMAND_MAX_DAYS,
  ADMIN_DEMAND_TOP_LIMIT,
  type AdminDemandFilters,
  type AdminDemandReport,
  type DemandCategoryRow,
  type DemandFilterRow,
  type DemandModeRow,
  type DemandQueryRow,
  type DemandSummary,
  type DemandTargetRow,
  type DemandTrendRow,
} from '#shared/types/admin_demand'
import type { SearchEventMode } from '#shared/types/search_event'
import type { DbQuery } from '#shared/types/database'

/** Langue de repli des libellés de catégorie quand la langue de l'écran manque. */
const FALLBACK_LOCALE = 'fr'

/**
 * Agrégations de l'écran « Ce que cherchent les clients » (#173). Lecture seule
 * sur `search_events` et `activity_events` ; toute la logique d'agrégation vit
 * ici, le contrôleur ne fait que transmettre les filtres. Les briques de lecture
 * des consultations sont partagées avec l'espace fournisseur
 * (`ActivityAggregationService`, #239).
 */
@inject()
export default class AdminDemandService {
  constructor(private activity: ActivityAggregationService) {}

  /** Filtres par défaut : les 30 derniers jours, tous écrans, langues et types d'organisation. */
  defaultFilters(now: DateTime = DateTime.now()): AdminDemandFilters {
    return {
      ...trailingDateRange(ADMIN_DEMAND_DEFAULT_DAYS, now),
      source: null,
      locale: null,
      organizationType: null,
    }
  }

  /**
   * Complète les filtres reçus (dates déjà validées) : période par défaut, `from`
   * déduit de `to` quand il manque, `to` ramené à `from` si `from` est dans le
   * futur, et durée plafonnée à `ADMIN_DEMAND_MAX_DAYS` (on garde la fin).
   */
  resolveFilters(query: {
    from?: DateTime
    to?: DateTime
    source?: AdminDemandFilters['source']
    locale?: string
    organizationType?: AdminDemandFilters['organizationType']
  }): AdminDemandFilters {
    const defaults = this.defaultFilters()
    const given = (date?: DateTime) => date?.startOf('day') ?? null
    const fromGiven = given(query.from)
    const toGiven = given(query.to)

    const to = toGiven ?? (fromGiven && fromGiven > DateTime.now() ? fromGiven : null)
    const end = to ?? DateTime.fromISO(defaults.to)
    let from = fromGiven ?? end.minus({ days: ADMIN_DEMAND_DEFAULT_DAYS - 1 })
    const earliest = end.minus({ days: ADMIN_DEMAND_MAX_DAYS - 1 })
    if (from < earliest) from = earliest

    return {
      from: from.toISODate()!,
      to: end.toISODate()!,
      source: query.source ?? null,
      locale: query.locale ?? null,
      organizationType: query.organizationType ?? null,
    }
  }

  async report(filters: AdminDemandFilters, uiLocale: string): Promise<AdminDemandReport> {
    const [
      summary,
      topQueries,
      zeroResultQueries,
      trend,
      modes,
      searchFilters,
      categories,
      viewedProducts,
      viewedSuppliers,
      rfqProducts,
    ] = await Promise.all([
      this.summary(filters),
      this.queries(filters, false),
      this.queries(filters, true),
      this.trend(filters),
      this.modes(filters),
      this.usedFilters(filters),
      this.categories(filters, uiLocale),
      this.products(filters, 'product_viewed', uiLocale),
      this.suppliers(filters, uiLocale),
      this.products(filters, 'rfq_product_added', uiLocale),
    ])

    return {
      summary,
      topQueries,
      zeroResultQueries,
      trend,
      modes,
      filters: searchFilters,
      categories,
      viewedProducts,
      viewedSuppliers,
      rfqProducts,
    }
  }

  /** Lignes du CSV des requêtes (plafonnées à `ADMIN_DEMAND_EXPORT_LIMIT`, hors limite des classements). */
  async queriesForExport(filters: AdminDemandFilters): Promise<DemandQueryRow[]> {
    return this.queries(filters, false, ADMIN_DEMAND_EXPORT_LIMIT)
  }

  /**
   * CSV (séparateur `;`, ouvrable dans Excel FR) des requêtes de la période. Une
   * cellule qui commence par `=`, `+`, `-` ou `@` est préfixée d'une apostrophe
   * (idem pour une tabulation ou un retour chariot en tête) : un terme saisi par un client ne doit pas s'exécuter comme formule.
   */
  async queriesCsv(filters: AdminDemandFilters, header: string[]): Promise<string> {
    const rows = await this.queriesForExport(filters)
    const cell = (value: string | number): string => {
      const text = /^[=+\-@\t\r]/.test(String(value)) ? `'${value}` : String(value)
      return `"${text.replace(/"/g, '""')}"`
    }
    const lines = [
      header,
      ...rows.map((row) => [row.query, row.searches, row.averageResults, row.zeroResultSearches]),
    ]
    return `\uFEFF${lines.map((line) => line.map(cell).join(';')).join('\r\n')}\r\n`
  }

  private searches(filters: AdminDemandFilters): DbQuery {
    const { start, end } = dateRangeBounds(filters)
    const query = db
      .from('search_events as se')
      .where('se.created_at', '>=', start)
      .where('se.created_at', '<', end)
    if (filters.source) query.where('se.source', filters.source)
    if (filters.locale) query.where('se.locale', filters.locale)
    this.byOrganizationType(query, filters, 'se.organization_id')
    return query
  }

  private events(filters: AdminDemandFilters): DbQuery {
    const query = this.activity.events(filters)
    this.byOrganizationType(query, filters, 'ae.organization_id')
    return query
  }

  /** Le type d'organisation filtre sur l'organisation à l'origine de l'événement. */
  private byOrganizationType(query: DbQuery, filters: AdminDemandFilters, column: string): void {
    if (!filters.organizationType) return
    query.whereIn(
      column,
      db.from('organizations').select('id').where('organization_type', filters.organizationType)
    )
  }

  private zone(): string {
    return DateTime.local().zoneName ?? 'UTC'
  }

  private async summary(filters: AdminDemandFilters): Promise<DemandSummary> {
    const row = await this.searches(filters)
      .select(
        db.raw('count(*)::int as searches'),
        db.raw('count(*) filter (where se.zero_results)::int as zero'),
        db.raw("count(*) filter (where se.mode = 'semantic')::int as semantic")
      )
      .first()

    const searches = Number(row?.searches ?? 0)
    const zero = Number(row?.zero ?? 0)
    const semantic = Number(row?.semantic ?? 0)
    return {
      searches,
      zeroResultSearches: zero,
      zeroResultRate: searches ? zero / searches : 0,
      semanticRate: searches ? semantic / searches : 0,
    }
  }

  private async queries(
    filters: AdminDemandFilters,
    zeroOnly: boolean,
    limit: number = ADMIN_DEMAND_TOP_LIMIT
  ): Promise<DemandQueryRow[]> {
    const query = this.searches(filters)
      .whereNotNull('se.query')
      .select(
        'se.query',
        db.raw('count(*)::int as searches'),
        db.raw('round(avg(se.results_count), 1)::float as average_results'),
        db.raw('count(*) filter (where se.zero_results)::int as zero')
      )
      .groupBy('se.query')
      .orderBy('searches', 'desc')
      .orderBy('se.query', 'asc')
    if (zeroOnly) query.having(db.raw('count(*) filter (where se.zero_results) > 0'))
    query.limit(limit)

    const rows = await query
    return rows.map((row) => ({
      query: String(row.query),
      searches: Number(row.searches),
      averageResults: Number(row.average_results),
      zeroResultSearches: Number(row.zero),
    }))
  }

  private async trend(filters: AdminDemandFilters): Promise<DemandTrendRow[]> {
    // Le jour est calculé dans le fuseau de l'application, comme les bornes de période.
    const rows = await this.searches(filters)
      .select(
        db.raw("to_char(se.created_at at time zone ?, 'YYYY-MM-DD') as day", [this.zone()]),
        db.raw('count(*)::int as searches'),
        db.raw('count(*) filter (where se.zero_results)::int as zero')
      )
      .groupBy('day')
      .orderBy('day', 'asc')

    return rows.map((row) => ({
      day: String(row.day),
      searches: Number(row.searches),
      zeroResultSearches: Number(row.zero),
    }))
  }

  private async modes(filters: AdminDemandFilters): Promise<DemandModeRow[]> {
    const rows = await this.searches(filters)
      .select('se.mode', db.raw('count(*)::int as searches'))
      .groupBy('se.mode')
      .orderBy('searches', 'desc')

    return rows.map((row) => ({
      mode: row.mode as SearchEventMode,
      searches: Number(row.searches),
    }))
  }

  /** Filtres posés par les clients : une ligne par nom de filtre (clé du JSON `filters`). */
  private async usedFilters(filters: AdminDemandFilters): Promise<DemandFilterRow[]> {
    const rows = await this.searches(filters)
      .whereRaw("jsonb_typeof(se.filters) = 'object'")
      .joinRaw('cross join lateral jsonb_object_keys(se.filters) as filter')
      .select('filter', db.raw('count(*)::int as searches'))
      .groupBy('filter')
      .orderBy('searches', 'desc')
      .orderBy('filter', 'asc')
      .limit(ADMIN_DEMAND_TOP_LIMIT)

    return rows.map((row) => ({ filter: String(row.filter), searches: Number(row.searches) }))
  }

  private async categories(
    filters: AdminDemandFilters,
    uiLocale: string
  ): Promise<DemandCategoryRow[]> {
    const rows = await this.searches(filters)
      .whereNotNull('se.category_id')
      .leftJoin('category_translations as ct', (join) =>
        join.on('ct.category_id', 'se.category_id').andOnVal('ct.locale', uiLocale)
      )
      .leftJoin('category_translations as cf', (join) =>
        join.on('cf.category_id', 'se.category_id').andOnVal('cf.locale', FALLBACK_LOCALE)
      )
      .select(
        'se.category_id',
        db.raw("coalesce(ct.name, cf.name, '#' || se.category_id) as name"),
        db.raw('count(*)::int as searches')
      )
      .groupBy('se.category_id', 'ct.name', 'cf.name')
      .orderBy('searches', 'desc')
      .limit(ADMIN_DEMAND_TOP_LIMIT)

    return rows.map((row) => ({
      categoryId: Number(row.category_id),
      name: String(row.name),
      searches: Number(row.searches),
    }))
  }

  /** Produits les plus consultés (`product_viewed`) ou ajoutés à une demande de devis. */
  private async products(
    filters: AdminDemandFilters,
    type: 'product_viewed' | 'rfq_product_added',
    uiLocale: string
  ): Promise<DemandTargetRow[]> {
    const rows = await this.activity.countByTarget(
      this.events(filters).where('ae.type', type),
      'product',
      ADMIN_DEMAND_TOP_LIMIT
    )
    return this.activity.named(rows, 'product', uiLocale)
  }

  /**
   * Fournisseurs les plus consultés. La cible de `supplier_viewed` est l'id de la
   * fiche (`suppliers.id`), pas celui de l'organisation. Seules les fiches encore
   * visibles au catalogue comptent (fiche existante, organisation ni archivée ni
   * rejetée), comme dans l'annuaire public.
   */
  private async suppliers(
    filters: AdminDemandFilters,
    uiLocale: string
  ): Promise<DemandTargetRow[]> {
    const rows = await this.activity.countByTarget(
      this.events(filters)
        .where('ae.type', 'supplier_viewed')
        .join('suppliers as s', 's.id', 'ae.target_id')
        .leftJoin('organizations as o', 'o.id', 's.organization_id')
        .where((visible) =>
          visible
            .whereNull('o.id')
            .orWhere((live) =>
              live
                .whereNull('o.archived_at')
                .whereRaw(`NOT ${latestDecisionIsRejectedSql('organization', 'o.id')}`)
            )
        ),
      'supplier',
      ADMIN_DEMAND_TOP_LIMIT
    )
    return this.activity.named(rows, 'supplier', uiLocale)
  }
}
