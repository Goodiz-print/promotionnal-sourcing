import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import AdminAuditService from '#services/admin_audit_service'
import ModerationService from '#services/moderation_service'
import User from '#models/user'
import { ModerationTargetNotFoundException } from '#exceptions/moderation_errors'
import { currentStatusSql } from '#shared/helpers/moderation'
import { resolveTranslation } from '#shared/helpers/translations'
import type {
  AdminModerationDetail,
  AdminModerationFilters,
  AdminModerationHistoryItem,
  AdminModerationItem,
  AdminModerationPending,
} from '#shared/types/admin_moderation'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type { PaginationMeta } from '#shared/types/pagination'
import type { ModerationDecision, ModerationTargetType } from '#shared/types/moderation'
import type { TranslationLocale } from '#shared/types/i18n'

/** Langue de repli du nom d'un produit quand la langue de l'écran manque. */
const FALLBACK_LOCALE = 'fr'

interface ListOptions extends AdminModerationFilters {
  page: number
  perPage: number
  locale: TranslationLocale
}

interface DecideOptions {
  targetType: ModerationTargetType
  targetId: number
  status: ModerationDecision
  reason: string | null
  decidedBy: User
  context: AdminActionContext
}

interface QueueRow {
  target_type: ModerationTargetType
  target_id: number
  label: string
  subtitle: string | null
  status: AdminModerationItem['status']
  submitted_at: Date
}

/**
 * Éléments à modérer : les organisations fournisseurs actives (`supplier`, `both`)
 * et les produits actifs. Chaque branche expose les mêmes colonnes pour être
 * réunie en une seule file triée par ancienneté.
 */
const SOURCES: Record<ModerationTargetType, string> = {
  organization: `
    SELECT 'organization' AS target_type, o.id AS target_id, o.name AS label,
           NULL::text AS subtitle, o.created_at AS submitted_at,
           ${currentStatusSql('organization', 'o.id')} AS status
    FROM organizations o
    WHERE o.archived_at IS NULL AND o.organization_type IN ('supplier', 'both')`,
  product: `
    SELECT 'product' AS target_type, p.id AS target_id, '' AS label,
           org.name AS subtitle, p.created_at AS submitted_at,
           ${currentStatusSql('product', 'p.id')} AS status
    FROM products p
    JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN organizations org ON org.id = s.organization_id
    WHERE p.is_active = true`,
}

/**
 * File de modération du back-office (#163) : liste des éléments par statut,
 * historique d'un élément et décision tracée dans le journal d'audit.
 */
@inject()
export default class AdminModerationService {
  constructor(
    private moderation: ModerationService,
    private audit: AdminAuditService
  ) {}

  async list(options: ListOptions) {
    const { page, perPage, locale } = options
    const { sql, bindings } = this.queue(options)

    const total = await db.rawQuery(`SELECT count(*)::int AS total FROM (${sql}) q`, bindings)
    const rows = await db.rawQuery<{ rows: QueueRow[] }>(
      `SELECT * FROM (${sql}) q ORDER BY submitted_at ASC, target_type ASC, target_id ASC
       LIMIT ? OFFSET ?`,
      [...bindings, perPage, (page - 1) * perPage]
    )

    const count: number = total.rows[0].total
    const meta: PaginationMeta = {
      total: count,
      perPage,
      currentPage: page,
      lastPage: Math.max(1, Math.ceil(count / perPage)),
    }
    return { data: await this.present(rows.rows, locale), meta }
  }

  /** Éléments en attente par type : compteur du tableau de bord. */
  async pending(): Promise<AdminModerationPending> {
    const [organization, product] = await Promise.all(
      (['organization', 'product'] as const).map(async (type) => {
        const { sql, bindings } = this.queue({
          type,
          status: 'pending',
          minAgeDays: 0,
        })
        const result = await db.rawQuery(`SELECT count(*)::int AS total FROM (${sql}) q`, bindings)
        return result.rows[0].total as number
      })
    )
    return { organization, product }
  }

  async detail(
    targetType: ModerationTargetType,
    targetId: number,
    locale: TranslationLocale
  ): Promise<AdminModerationDetail> {
    const { sql, bindings } = this.queue({ type: targetType, status: null, minAgeDays: 0 })
    const found = await db.rawQuery<{ rows: QueueRow[] }>(
      `SELECT * FROM (${sql}) q WHERE target_id = ?`,
      [...bindings, targetId]
    )
    if (found.rows.length === 0) throw new ModerationTargetNotFoundException()
    const [item] = await this.present(found.rows, locale)

    const records = await this.moderation.history(targetType, targetId).preload('decidedBy')
    const history: AdminModerationHistoryItem[] = records.map((record) => ({
      id: record.id,
      status: record.status,
      reason: record.reason,
      decidedByEmail: record.decidedBy?.email ?? null,
      decidedAt: record.decidedAt.toISO()!,
    }))
    return { item, history }
  }

  /**
   * Enregistre la décision et sa trace d'audit dans une même transaction ; la
   * réindexation du catalogue part une fois la transaction validée.
   */
  async decide(options: DecideOptions): Promise<void> {
    const { targetType, targetId, status, reason, decidedBy, context } = options
    const { sql, bindings } = this.queue({ type: targetType, status: null, minAgeDays: 0 })
    const found = await db.rawQuery<{ rows: QueueRow[] }>(
      `SELECT status FROM (${sql}) q WHERE target_id = ?`,
      [...bindings, targetId]
    )
    if (found.rows.length === 0) throw new ModerationTargetNotFoundException()
    const previous = found.rows[0].status

    await db.transaction(async (trx) => {
      await this.moderation.decide({ targetType, targetId, status, decidedBy, reason }, trx)
      await this.audit.record(
        {
          action: status === 'approved' ? 'moderation.approved' : 'moderation.rejected',
          targetType,
          targetId,
          changes: {
            before: { status: previous },
            after: { status, reason },
          },
        },
        { ...context, client: trx }
      )
    })
  }

  /** SQL de la file, avec filtres de type, de statut et d'ancienneté. */
  private queue(
    filters: Pick<AdminModerationFilters, 'type' | 'minAgeDays'> & {
      status: AdminModerationFilters['status'] | null
    }
  ): { sql: string; bindings: (string | number)[] } {
    const types = filters.type ? [filters.type] : (Object.keys(SOURCES) as ModerationTargetType[])
    const conditions: string[] = []
    const bindings: (string | number)[] = []
    if (filters.status) {
      conditions.push('status = ?')
      bindings.push(filters.status)
    }
    if (filters.minAgeDays > 0) {
      conditions.push(`submitted_at <= now() - (? * interval '1 day')`)
      bindings.push(filters.minAgeDays)
    }
    const union = types.map((type) => SOURCES[type]).join(' UNION ALL ')
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''
    return { sql: `SELECT * FROM (${union}) u${where}`, bindings }
  }

  /** Libellé des produits (nom traduit) puis forme DTO. */
  private async present(
    rows: QueueRow[],
    locale: TranslationLocale
  ): Promise<AdminModerationItem[]> {
    const productIds = rows.filter((row) => row.target_type === 'product').map((r) => r.target_id)
    const names = await this.productNames(productIds, locale)

    return rows.map((row) => ({
      targetType: row.target_type,
      targetId: row.target_id,
      label:
        row.target_type === 'product'
          ? (names.get(row.target_id) ?? `#${row.target_id}`)
          : row.label,
      subtitle: row.subtitle,
      status: row.status,
      submittedAt: new Date(row.submitted_at).toISOString(),
    }))
  }

  private async productNames(
    ids: number[],
    locale: TranslationLocale
  ): Promise<Map<number, string>> {
    const names = new Map<number, string>()
    if (ids.length === 0) return names

    const [translations, products] = await Promise.all([
      db
        .from('product_translations')
        .whereIn('product_id', ids)
        .select('product_id', 'locale', 'name'),
      db.from('products').whereIn('id', ids).select('id', 'source_locale'),
    ])
    const sources = new Map<number, string>(products.map((p) => [p.id, p.source_locale]))

    for (const id of ids) {
      const own = translations.filter((row) => row.product_id === id)
      const picked = resolveTranslation(own, locale, {
        sourceLocale: sources.get(id) as TranslationLocale | undefined,
        fallback: FALLBACK_LOCALE,
      })
      if (picked?.name) names.set(id, picked.name)
    }
    return names
  }
}
