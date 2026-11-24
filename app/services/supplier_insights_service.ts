import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import ActivityAggregationService from '#services/activity_aggregation_service'
import { identifiableSince, trailingDateRange } from '#shared/helpers/activity_event'
import { clampPage, toPaginationMeta } from '#shared/helpers/pagination'
import type { ActivityDateRange } from '#shared/types/activity_event'
import {
  SUPPLIER_INSIGHTS_AGENCY_LIMIT,
  SUPPLIER_INSIGHTS_PER_PAGE,
  type SupplierInsightsAgencyRow,
  type SupplierInsightsProductRow,
  type SupplierInsightsQuery,
  type SupplierInsightsReport,
  type SupplierInsightsSummary,
} from '#shared/types/supplier_insights'
import type { Paginated } from '#shared/types/pagination'

type Query = ReturnType<typeof db.from>

/** Événements comptés : consultations et ajouts à une demande de devis. */
const COUNTED_TYPES = ['product_viewed', 'supplier_viewed', 'rfq_product_added'] as const

/** Consultations qui nomment une agence (l'ajout à une demande passe déjà par la demande). */
const VIEW_TYPES = ['product_viewed', 'supplier_viewed'] as const

/** Organisations « agence » : celles qui achètent. */
const AGENCY_TYPES = ['buyer', 'both'] as const

/**
 * Consultations des produits et de la fiche d'un fournisseur (#239). Lecture
 * seule sur `activity_events`, cloisonnée aux cibles de l'organisation (ses
 * produits, sa fiche) : un fournisseur ne voit jamais les consultations d'un
 * autre.
 *
 * Les compteurs incluent les événements pseudonymisés (plus de 90 jours). La
 * liste des agences n'est **lue** que pour un fournisseur abonné
 * (`revealAgencies`) : pour un non abonné, aucune identité ne quitte la base.
 */
@inject()
export default class SupplierInsightsService {
  constructor(private activity: ActivityAggregationService) {}

  async report(
    organizationId: number,
    query: SupplierInsightsQuery
  ): Promise<SupplierInsightsReport> {
    const now = DateTime.now()
    const range = trailingDateRange(query.period, now)
    const [summary, products, agencies] = await Promise.all([
      this.summary(organizationId, range),
      this.products(organizationId, range, query),
      query.revealAgencies ? this.agencies(organizationId, range, now) : null,
    ])
    return { range, summary, products, agencies }
  }

  /** Totaux de la période. */
  async summary(
    organizationId: number,
    range: ActivityDateRange
  ): Promise<SupplierInsightsSummary> {
    const row = await this.ownEvents(organizationId, range)
      .whereIn('ae.type', [...COUNTED_TYPES])
      .select(
        db.raw("count(*) filter (where ae.type = 'product_viewed')::int as product_views"),
        db.raw("count(*) filter (where ae.type = 'supplier_viewed')::int as supplier_views"),
        db.raw("count(*) filter (where ae.type = 'rfq_product_added')::int as rfq_additions"),
        db.raw(
          "count(distinct ae.target_id) filter (where ae.type = 'product_viewed')::int as viewed_products"
        )
      )
      .first()

    return {
      productViews: Number(row?.product_views ?? 0),
      supplierViews: Number(row?.supplier_views ?? 0),
      rfqAdditions: Number(row?.rfq_additions ?? 0),
      viewedProducts: Number(row?.viewed_products ?? 0),
    }
  }

  /**
   * Tous les produits du fournisseur, même jamais consultés, les plus consultés
   * en tête. Les compteurs sont agrégés une fois (CTE), puis joints aux produits.
   */
  async products(
    organizationId: number,
    range: ActivityDateRange,
    query: Pick<SupplierInsightsQuery, 'page' | 'locale'>
  ): Promise<Paginated<SupplierInsightsProductRow>> {
    const page = await this.productPage(organizationId, range, query.page)

    const rows = page.all().map((row) => ({
      targetId: Number(row.id),
      views: Number(row.views),
      rfqAdditions: Number(row.rfq_additions),
    }))
    const named = await this.activity.named(rows, 'product', query.locale)
    return {
      data: named.map(({ targetId, ...row }) => ({ productId: targetId, ...row })),
      meta: toPaginationMeta(page),
    }
  }

  /**
   * Agences ayant consulté un produit ou la fiche, la plus récente en tête.
   * Seuls les événements encore rattachés (moins de 90 jours) nomment une agence,
   * et seulement une agence validée (cf. `validatedAgency`).
   */
  async agencies(
    organizationId: number,
    range: ActivityDateRange,
    now: DateTime = DateTime.now()
  ): Promise<SupplierInsightsAgencyRow[]> {
    const rows = await this.ownEvents(organizationId, range)
      .whereIn('ae.type', [...VIEW_TYPES])
      .where('ae.created_at', '>=', identifiableSince(range, now))
      .join('organizations as o', 'o.id', 'ae.organization_id')
      .where((agency) => this.validatedAgency(agency))
      .select(
        'o.name',
        db.raw('count(*)::int as views'),
        db.raw(
          "count(distinct ae.target_id) filter (where ae.target_type = 'product')::int as products"
        ),
        db.raw('max(ae.created_at) as last_viewed_at')
      )
      .groupBy('o.id', 'o.name')
      .orderBy('last_viewed_at', 'desc')
      .orderBy('o.name', 'asc')
      .limit(SUPPLIER_INSIGHTS_AGENCY_LIMIT)

    return rows.map((row) => ({
      name: String(row.name),
      views: Number(row.views),
      products: Number(row.products),
      lastViewedAt: DateTime.fromJSDate(row.last_viewed_at).toISO()!,
    }))
  }

  /**
   * Page demandée du tableau ; une page au-delà de la dernière (URL modifiée,
   * produits supprimés depuis) est ramenée à la dernière.
   */
  private async productPage(organizationId: number, range: ActivityDateRange, requested: number) {
    const paginate = (page: number) =>
      this.productsWithCounts(organizationId, range).paginate(page, SUPPLIER_INSIGHTS_PER_PAGE)
    const page = await paginate(requested)
    const target = clampPage(requested, page.lastPage)
    return target === requested ? page : paginate(target)
  }

  /** Produits de l'organisation et leurs compteurs (CTE `counts`), les plus consultés en tête. */
  private productsWithCounts(organizationId: number, range: ActivityDateRange): Query {
    return db
      .query()
      .with('counts', this.productCounts(organizationId, range))
      .from('products as p')
      .join('suppliers as s', 's.id', 'p.supplier_id')
      .leftJoin('counts as c', 'c.target_id', 'p.id')
      .where('s.organization_id', organizationId)
      .select(
        'p.id',
        db.raw('coalesce(c.views, 0)::int as views'),
        db.raw('coalesce(c.rfq_additions, 0)::int as rfq_additions')
      )
      .orderBy('views', 'desc')
      .orderBy('rfq_additions', 'desc')
      .orderBy('p.id', 'asc')
  }

  /** Consultations et ajouts à une demande, par produit de l'organisation. */
  private productCounts(organizationId: number, range: ActivityDateRange): Query {
    return this.activity
      .events(range)
      .where('ae.target_type', 'product')
      .whereIn('ae.type', ['product_viewed', 'rfq_product_added'])
      .whereIn('ae.target_id', this.ownProductIds(organizationId))
      .select(
        'ae.target_id',
        db.raw("count(*) filter (where ae.type = 'product_viewed')::int as views"),
        db.raw("count(*) filter (where ae.type = 'rfq_product_added')::int as rfq_additions")
      )
      .groupBy('ae.target_id')
  }

  /**
   * Organisation `o` nommable : une **agence** (`buyer` ou `both`) **validée**,
   * comme pour l'équipe commerciale (`SupplierContactService`) — ni archivée
   * (compte fermé, agence refusée), ni en cours de validation (`review_reasons`).
   */
  private validatedAgency(query: Query): Query {
    return query
      .whereIn('o.organization_type', [...AGENCY_TYPES])
      .whereNull('o.archived_at')
      .whereRaw('cardinality(o.review_reasons) = 0')
  }

  /** Événements de la période qui visent un produit ou la fiche de l'organisation. */
  private ownEvents(organizationId: number, range: ActivityDateRange): Query {
    return this.activity
      .events(range)
      .where((own) =>
        own
          .where((product) =>
            product
              .where('ae.target_type', 'product')
              .whereIn('ae.target_id', this.ownProductIds(organizationId))
          )
          .orWhere((supplier) =>
            supplier
              .where('ae.target_type', 'supplier')
              .whereIn('ae.target_id', this.ownSupplierIds(organizationId))
          )
      )
  }

  private ownSupplierIds(organizationId: number): Query {
    return db.from('suppliers').select('id').where('organization_id', organizationId)
  }

  private ownProductIds(organizationId: number): Query {
    return db
      .from('products')
      .select('products.id')
      .join('suppliers', 'suppliers.id', 'products.supplier_id')
      .where('suppliers.organization_id', organizationId)
  }
}
