import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import aiConfig from '#config/ai'
import ProductChanged from '#events/product_changed'
import TranslationBackfillJob from '#jobs/translation_backfill_job'
import AdminAuditService from '#services/admin_audit_service'
import { AdminTranslationNotFoundException } from '#exceptions/admin_errors'
import {
  AI_BACKFILL_COOLDOWN_MINUTES,
  AI_OVERVIEW_DAYS,
  type AdminAiCoverageRow,
  type AdminAiDailyVolume,
  type AdminAiFailure,
  type AdminAiOverview,
  type AdminAiTotals,
  type AdminAiTranslationDbRow,
  type AdminAiTranslationFilters,
  type AdminAiTranslationRow,
  type AiBackfillRequestResult,
} from '#shared/types/admin_ai'
import {
  ENTITY_TRANSLATION_TABLES,
  TRANSLATABLE_ENTITIES,
  type AiCallStatus,
  type TranslatableEntity,
} from '#shared/types/ai'
import type { AdminActionContext } from '#shared/types/admin_audit'
import { TRANSLATION_LOCALES } from '#shared/types/i18n'
import type { Paginated } from '#shared/types/pagination'

/** Verrou applicatif : deux clics simultanés ne lancent qu'un seul rattrapage. */
const BACKFILL_LOCK_KEY = 1_770_177

/** Valeurs avant/après de l'audit : tronquées, un texte long n'a pas à tout être recopié. */
const AUDIT_TEXT_LENGTH = 500

const iso = (value: Date | string): string => new Date(value).toISOString()
const contains = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`
const num = (value: unknown): number => Number(value ?? 0)

/**
 * IA et traductions vues du back-office (#177) : volume, tokens et coût du
 * fournisseur, couverture par langue, échecs, rattrapage et relecture des
 * traductions automatiques. Les entités sont décrites par
 * `ENTITY_TRANSLATION_TABLES` : les noms de table et de colonne viennent de ce
 * registre, jamais de la requête.
 */
@inject()
export default class AdminAiService {
  constructor(private audit: AdminAuditService) {}

  async overview(): Promise<AdminAiOverview> {
    const since = new Date(Date.now() - AI_OVERVIEW_DAYS * 86_400_000)
    const [totals, daily, coverage, failures] = await Promise.all([
      this.totals(since),
      this.daily(since),
      this.coverage(),
      this.failures(),
    ])

    const { inputPerMillion, outputPerMillion, currency } = aiConfig.pricing
    return {
      enabled: aiConfig.translation.enabled,
      model: aiConfig.translation.model,
      promptVersion: aiConfig.translation.promptVersion,
      pricing:
        inputPerMillion !== undefined && outputPerMillion !== undefined
          ? { input: inputPerMillion, output: outputPerMillion, currency }
          : null,
      days: AI_OVERVIEW_DAYS,
      totals,
      daily,
      coverage,
      failures,
    }
  }

  /**
   * Met en file un rattrapage des traductions (tous les types, ou un seul).
   * Refusé si l'IA est désactivée, ou si un rattrapage a déjà été demandé depuis
   * moins de `AI_BACKFILL_COOLDOWN_MINUTES` : chaque passage parcourt tout le
   * catalogue. Le verrou, le délai, l'audit et la mise en file sont dans la même
   * transaction : si la mise en file échoue, le délai n'est pas consommé.
   */
  async requestBackfill(
    entity: TranslatableEntity | undefined,
    context: AdminActionContext
  ): Promise<AiBackfillRequestResult> {
    if (!aiConfig.translation.enabled) return 'disabled'

    return db.transaction(async (trx) => {
      await trx.rawQuery('select pg_advisory_xact_lock(?)', [BACKFILL_LOCK_KEY])

      const recent = await trx
        .from('admin_audit_logs')
        .where('action', 'ai.backfill_requested')
        .where('created_at', '>', new Date(Date.now() - AI_BACKFILL_COOLDOWN_MINUTES * 60_000))
        .first()
      if (recent) return 'too_soon' as const

      await this.audit.record(
        {
          action: 'ai.backfill_requested',
          targetType: 'ai_backfill',
          targetId: null,
          changes: { after: { entity: entity ?? 'all' } },
        },
        { ...context, client: trx }
      )
      await TranslationBackfillJob.dispatch({ entities: entity ? [entity] : undefined })
      return 'queued' as const
    })
  }

  /** Traductions de langue (hors langue source) à relire, 25 par page. */
  async translations(
    filters: AdminAiTranslationFilters & { page: number; perPage: number }
  ): Promise<Paginated<AdminAiTranslationRow>> {
    const { table, foreignKey, parentTable, fields } = ENTITY_TRANSLATION_TABLES[filters.entity]

    const query = db
      .from(`${table} as t`)
      .join(`${parentTable} as p`, 'p.id', `t.${foreignKey}`)
      .leftJoin(`${table} as s`, (join) =>
        join.on(`s.${foreignKey}`, `t.${foreignKey}`).andOn('s.locale', 'p.source_locale')
      )
      .whereRaw('t.locale <> p.source_locale')
      .select(
        `t.${foreignKey} as entity_id`,
        't.locale',
        'p.source_locale',
        't.is_auto',
        't.updated_at',
        ...fields.flatMap((field) => [`t.${field} as ${field}`, `s.${field} as source_${field}`])
      )

    if (filters.locale) query.where('t.locale', filters.locale)
    if (filters.origin) query.where('t.is_auto', filters.origin === 'auto')
    if (filters.search) {
      const term = contains(filters.search)
      query.where((group) => {
        for (const field of fields) group.orWhereRaw(`t.${field} ILIKE ?`, [term])
      })
    }

    const paginator = await query
      .orderByRaw('t.updated_at DESC NULLS LAST')
      .orderBy(`t.${foreignKey}`, 'desc')
      .orderBy('t.locale')
      .paginate(filters.page, filters.perPage)

    const { data, meta } = paginator.toJSON()
    return {
      data: data.map((row: AdminAiTranslationDbRow) =>
        this.presentTranslation(filters.entity, row)
      ),
      meta: {
        total: meta.total,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
      },
    }
  }

  /**
   * Corrige (ou valide telle quelle) une traduction automatique : la ligne passe
   * en `is_auto = false`, donc plus jamais écrasée par l'IA. Un champ absent de
   * `values` est conservé. Le champ principal (`name` / `label`) ne peut pas être
   * vidé. La langue source n'est pas modifiable ici (c'est la saisie du fournisseur).
   * Retourne `false` si une valeur est invalide (rien n'est écrit).
   */
  async correct(
    entity: TranslatableEntity,
    entityId: number,
    locale: string,
    values: Record<string, string | null | undefined>,
    context: AdminActionContext
  ): Promise<boolean> {
    const { table, foreignKey, parentTable, fields } = ENTITY_TRANSLATION_TABLES[entity]
    if (!(TRANSLATION_LOCALES as readonly string[]).includes(locale)) {
      throw new AdminTranslationNotFoundException()
    }

    const updates: Record<string, string | null> = {}
    for (const field of fields) {
      const value = values[field]
      if (value === undefined) continue
      if (!value && field === fields[0]) return false
      updates[field] = value || null
    }

    await db.transaction(async (trx) => {
      const current = await trx
        .from(`${table} as t`)
        .join(`${parentTable} as p`, 'p.id', `t.${foreignKey}`)
        .where(`t.${foreignKey}`, entityId)
        .where('t.locale', locale)
        .whereRaw('t.locale <> p.source_locale')
        .select(...fields.map((field) => `t.${field} as ${field}`))
        .forUpdate('t')
        .first()
      if (!current) throw new AdminTranslationNotFoundException()

      const before: Record<string, string | null> = {}
      const after: Record<string, string | null> = {}
      for (const [field, value] of Object.entries(updates)) {
        if ((current[field] ?? null) === value) continue
        before[field] = this.clip(current[field])
        after[field] = this.clip(value)
      }

      await trx
        .from(table)
        .where(foreignKey, entityId)
        .where('locale', locale)
        .update({ ...updates, is_auto: false, updated_at: new Date() })

      await this.audit.record(
        {
          action: 'translation.corrected',
          targetType: 'translation',
          targetId: entityId,
          changes: {
            before,
            after: { ...after, entity, locale },
          },
        },
        { ...context, client: trx }
      )
    })

    // La recherche indexe les noms et descriptions traduits : ré-indexation du produit.
    if (entity === 'product') await emitter.emit(ProductChanged, new ProductChanged(entityId))
    return true
  }

  private async totals(since: Date): Promise<AdminAiTotals> {
    const row = await db
      .from('ai_calls')
      .where('created_at', '>=', since)
      .select(
        db.raw('count(*) as calls'),
        db.raw("count(*) filter (where status = 'failed') as failed"),
        db.raw("count(*) filter (where status = 'truncated') as truncated"),
        db.raw('coalesce(sum(prompt_tokens), 0) as prompt_tokens'),
        db.raw('coalesce(sum(completion_tokens), 0) as completion_tokens')
      )
      .first()

    const promptTokens = num(row?.prompt_tokens)
    const completionTokens = num(row?.completion_tokens)
    const { inputPerMillion, outputPerMillion } = aiConfig.pricing
    const estimatedCost =
      inputPerMillion !== undefined && outputPerMillion !== undefined
        ? (promptTokens * inputPerMillion + completionTokens * outputPerMillion) / 1_000_000
        : null

    return {
      calls: num(row?.calls),
      failed: num(row?.failed),
      truncated: num(row?.truncated),
      promptTokens,
      completionTokens,
      estimatedCost,
    }
  }

  /** Une entrée par jour de la fenêtre, y compris les jours sans appel. */
  private async daily(since: Date): Promise<AdminAiDailyVolume[]> {
    const rows = await db
      .from('ai_calls')
      .where('created_at', '>=', since)
      .select(
        db.raw("to_char(created_at, 'YYYY-MM-DD') as day"),
        db.raw('count(*) as calls'),
        db.raw("count(*) filter (where status <> 'success') as failed"),
        db.raw('coalesce(sum(prompt_tokens + completion_tokens), 0) as tokens')
      )
      .groupByRaw("to_char(created_at, 'YYYY-MM-DD')")
    const byDay = new Map(rows.map((row) => [row.day as string, row]))

    const days: AdminAiDailyVolume[] = []
    for (let offset = AI_OVERVIEW_DAYS - 1; offset >= 0; offset--) {
      const day = new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
      const row = byDay.get(day)
      days.push({
        day,
        calls: num(row?.calls),
        failed: num(row?.failed),
        tokens: num(row?.tokens),
      })
    }
    return days
  }

  /**
   * Par langue : nombre d'entités traduites (IA / à la main) sur le total. Le total
   * compte les produits actifs et toutes les autres entités ; la langue source de
   * chaque entité compte comme « à la main ».
   */
  private async coverage(): Promise<AdminAiCoverageRow[]> {
    const byLocale = new Map<string, AdminAiCoverageRow>(
      TRANSLATION_LOCALES.map((locale) => [locale, { locale, total: 0, auto: 0, manual: 0 }])
    )

    let total = 0
    for (const entity of TRANSLATABLE_ENTITIES) {
      const { table, parentTable } = ENTITY_TRANSLATION_TABLES[entity]
      const parents = db.from(parentTable)
      if (entity === 'product') parents.where('is_active', true)
      const [{ count }] = await parents.count('* as count')
      total += num(count)

      const rows = await db
        .from(table)
        .select('locale')
        .select(db.raw('count(*) filter (where is_auto) as auto'))
        .select(db.raw('count(*) filter (where not is_auto) as manual'))
        .groupBy('locale')
      for (const row of rows) {
        const entry = byLocale.get(row.locale)
        if (!entry) continue
        entry.auto += num(row.auto)
        entry.manual += num(row.manual)
      }
    }

    return [...byLocale.values()].map((entry) => ({ ...entry, total }))
  }

  private async failures(): Promise<AdminAiFailure[]> {
    const rows = await db
      .from('ai_calls')
      .whereNot('status', 'success')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(10)
      .select(
        'id',
        'entity',
        'entity_id',
        'model',
        'status',
        'target_locales',
        'error',
        'created_at'
      )

    return rows.map((row) => ({
      id: row.id,
      entity: row.entity,
      entityId: row.entity_id,
      model: row.model,
      status: row.status as AiCallStatus,
      targetLocales:
        typeof row.target_locales === 'string'
          ? JSON.parse(row.target_locales)
          : row.target_locales,
      error: row.error,
      createdAt: iso(row.created_at),
    }))
  }

  private presentTranslation(
    entity: TranslatableEntity,
    row: AdminAiTranslationDbRow
  ): AdminAiTranslationRow {
    return {
      entity,
      entityId: row.entity_id,
      locale: row.locale,
      sourceLocale: row.source_locale,
      isAuto: row.is_auto,
      fields: ENTITY_TRANSLATION_TABLES[entity].fields.map((name) => ({
        name,
        source: (row[`source_${name}`] as string | null) ?? null,
        value: (row[name] as string | null) ?? null,
      })),
      updatedAt: iso(row.updated_at ?? new Date(0)),
    }
  }

  private clip(value: unknown): string | null {
    return typeof value === 'string' ? value.slice(0, AUDIT_TEXT_LENGTH) : null
  }
}
