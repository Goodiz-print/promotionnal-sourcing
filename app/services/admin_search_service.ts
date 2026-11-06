import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import searchConfig from '#config/search'
import SearchRunJob from '#jobs/search_run_job'
import AdminAuditService from '#services/admin_audit_service'
import ProductIndexService from '#services/product_index_service'
import SearchEngine from '#services/search/search_engine'
import SearchEvaluationService from '#services/search/search_evaluation_service'
import {
  SEARCH_DRIFT_SAMPLE,
  SEARCH_ERROR_MAX_LENGTH,
  SEARCH_PROBE_TIMEOUT_MS,
  SEARCH_RUN_HISTORY,
  SEARCH_RUN_STALE_MS,
  type AdminSearchDrift,
  type AdminSearchOverview,
  type AdminSearchRun,
  type AdminSearchRunDbRow,
  type AdminSearchStatus,
  type SearchEvaluationSummary,
  type SearchRequestResult,
  type SearchRunKind,
  type SearchRunStatus,
} from '#shared/types/admin_search'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type { SearchEvaluationReport } from '#shared/types/search'

/** Verrou applicatif : deux clics simultanés ne mettent en file qu'une seule opération. */
const REQUEST_LOCK_KEY = 1_770_176

const RUN_COLUMNS = [
  'id',
  'kind',
  'status',
  'supplier_id',
  'supplier_name',
  'processed',
  'total',
  'result',
  'error',
  'requested_by_email',
  'created_at',
  'started_at',
  'finished_at',
] as const

const iso = (value: Date | string | null): string | null =>
  value === null ? null : new Date(value).toISOString()
const truncate = (message: string) => message.slice(0, SEARCH_ERROR_MAX_LENGTH)

/** Rejette si `promise` ne répond pas à temps : un moteur muet ne doit pas figer l'écran. */
async function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Meilisearch did not answer within ${ms} ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * État de la recherche vu du back-office (#176) : moteur actif ou inerte, santé,
 * documents et tâches de Meilisearch, écart avec PostgreSQL, réindexation et
 * évaluation de pertinence lancées par la queue (`SearchRunJob`) avec suivi
 * d'avancement dans `search_runs`.
 *
 * Importe `ProductIndexService` (donc le modèle `Product`) : ce service n'est
 * jamais importé par un module de job, qui le résout dans `execute()`.
 */
@inject()
export default class AdminSearchService {
  constructor(
    private audit: AdminAuditService,
    private engine: SearchEngine,
    private index: ProductIndexService,
    private evaluation: SearchEvaluationService
  ) {}

  async overview(): Promise<AdminSearchOverview> {
    const [status, reindexRuns, evaluationRuns] = await Promise.all([
      this.status(),
      this.runs('reindex'),
      this.runs('evaluation'),
    ])
    const active = [...reindexRuns, ...evaluationRuns].some((run) => this.isActive(run))
    return { status, reindexRuns, evaluationRuns, active }
  }

  async status(): Promise<AdminSearchStatus> {
    const { embedder } = searchConfig
    const base = {
      index: searchConfig.index,
      embedder: { enabled: embedder.enabled, provider: embedder.provider, model: embedder.model },
      semanticRatio: searchConfig.semanticRatio,
      info: null,
      error: null,
    }
    if (!this.engine.enabled) return { ...base, state: 'disabled' }

    try {
      const info = await within(this.engine.inspect(), SEARCH_PROBE_TIMEOUT_MS)
      return { ...base, state: 'ready', info }
    } catch (error) {
      logger.warn({ err: error }, 'search engine unreachable')
      return { ...base, state: 'unreachable', error: truncate((error as Error).message) }
    }
  }

  /**
   * Écart entre ce que PostgreSQL veut dans l'index (produits visibles) et ce
   * que l'index contient. `null` si le moteur est inerte ou injoignable.
   */
  async drift(): Promise<AdminSearchDrift | null> {
    if (!this.engine.enabled) return null

    try {
      const expected = new Set<number>()
      for await (const ids of this.index.visibleProductIds()) for (const id of ids) expected.add(id)
      const indexed = new Set<number>()
      for await (const ids of this.engine.documentIds()) for (const id of ids) indexed.add(id)

      const missing = [...expected].filter((id) => !indexed.has(id))
      const extra = [...indexed].filter((id) => !expected.has(id))
      return {
        expected: expected.size,
        indexed: indexed.size,
        missing: missing.slice(0, SEARCH_DRIFT_SAMPLE),
        missingCount: missing.length,
        extra: extra.slice(0, SEARCH_DRIFT_SAMPLE),
        extraCount: extra.length,
        checkedAt: new Date().toISOString(),
      }
    } catch (error) {
      logger.warn({ err: error }, 'search drift check failed')
      return null
    }
  }

  /** Réindexation complète (`supplierId` absent) ou d'un seul fournisseur. */
  async requestReindex(
    supplierId: number | null,
    context: AdminActionContext
  ): Promise<SearchRequestResult> {
    if (!this.engine.enabled) return 'disabled'
    return this.enqueue('reindex', supplierId, context)
  }

  async requestEvaluation(context: AdminActionContext): Promise<SearchRequestResult> {
    if (!this.engine.enabled) return 'disabled'
    return this.enqueue('evaluation', null, context)
  }

  /**
   * Exécution d'une opération demandée (appelée par `SearchRunJob`). Sans effet
   * si elle n'est plus `pending` (rejeu du job). Une erreur est conservée sur
   * l'opération, sans être propagée : l'admin relance depuis l'écran.
   */
  async execute(runId: number): Promise<void> {
    const claimed = await db
      .from('search_runs')
      .where('id', runId)
      .where('status', 'pending')
      .update({ status: 'running', started_at: new Date() })
    if (!claimed) return

    const run = await db.from('search_runs').where('id', runId).first()
    try {
      if (run.kind === 'reindex') await this.executeReindex(runId, run.supplier_id)
      else await this.executeEvaluation(runId)
    } catch (error) {
      logger.error({ err: error, runId }, 'search run failed')
      await db
        .from('search_runs')
        .where('id', runId)
        .update({
          status: 'failed',
          error: truncate((error as Error).message),
          finished_at: new Date(),
        })
    }
  }

  private async executeReindex(runId: number, supplierId: number | null) {
    const total = await this.index.countProducts(supplierId ?? undefined)
    await db.from('search_runs').where('id', runId).update({ total })

    const progress = async (scanned: number) => {
      await db.from('search_runs').where('id', runId).update({ processed: scanned })
    }
    let indexed: number
    if (supplierId === null) {
      indexed = await this.index.reindexAll(progress)
    } else {
      const result = await this.index.syncSupplier(supplierId, progress)
      indexed = result.indexed
    }

    await db
      .from('search_runs')
      .where('id', runId)
      .update({
        status: 'completed',
        processed: total,
        result: JSON.stringify({ indexed }),
        finished_at: new Date(),
      })
  }

  private async executeEvaluation(runId: number) {
    const report = await this.evaluation.evaluate()
    await db
      .from('search_runs')
      .where('id', runId)
      .update({
        status: 'completed',
        result: JSON.stringify(AdminSearchService.summarize(report)),
        finished_at: new Date(),
      })
  }

  /** Rapport conservé : les totaux et les requêtes en échec, pas le détail des réussies. */
  static summarize(report: SearchEvaluationReport): SearchEvaluationSummary {
    const { results, ...totals } = report
    return {
      ...totals,
      failures: results
        .filter((result) => result.status === 'failed')
        .map((result) => ({
          id: result.id,
          query: result.query,
          missing: result.missing,
          unexpected: result.unexpected,
        })),
    }
  }

  private async enqueue(
    kind: SearchRunKind,
    supplierId: number | null,
    context: AdminActionContext
  ): Promise<SearchRequestResult> {
    const outcome = await db.transaction(async (trx) => {
      await trx.rawQuery('select pg_advisory_xact_lock(?)', [REQUEST_LOCK_KEY])

      const busy = await trx
        .from('search_runs')
        .where('kind', kind)
        .whereIn('status', ['pending', 'running'])
        .where('created_at', '>', new Date(Date.now() - SEARCH_RUN_STALE_MS))
        .select('id')
        .first()
      if (busy) return 'busy' as const

      let supplierName: string | null = null
      if (supplierId !== null) {
        const supplier = await trx.from('suppliers').where('id', supplierId).select('name').first()
        if (!supplier) return 'unknown_supplier' as const
        supplierName = supplier.name
      }

      const [created] = await trx
        .table('search_runs')
        .insert({
          kind,
          status: 'pending',
          supplier_id: supplierId,
          supplier_name: supplierName,
          requested_by_id: context.actor?.id ?? null,
          requested_by_email: context.actor?.email ?? null,
          created_at: new Date(),
        })
        .returning('id')

      await this.audit.record(
        {
          action: kind === 'reindex' ? 'search.reindex_requested' : 'search.evaluation_requested',
          targetType: 'search_run',
          targetId: created.id,
          changes: { after: { kind, supplierId } },
        },
        { ...context, client: trx }
      )
      return created.id as number
    })
    if (typeof outcome === 'string') return outcome

    // Après le commit : le worker doit trouver la ligne.
    try {
      await SearchRunJob.dispatch({ runId: outcome })
    } catch (error) {
      logger.error({ err: error, runId: outcome }, 'failed to queue search run')
      await db
        .from('search_runs')
        .where('id', outcome)
        .update({ status: 'failed', error: 'Queue unavailable', finished_at: new Date() })
      return 'queue_failed'
    }
    return 'queued'
  }

  private async runs(kind: SearchRunKind): Promise<AdminSearchRun[]> {
    const rows: AdminSearchRunDbRow[] = await db
      .from('search_runs')
      .where('kind', kind)
      .orderBy('id', 'desc')
      .limit(SEARCH_RUN_HISTORY)
      .select(...RUN_COLUMNS)
    return rows.map((row) => AdminSearchService.present(row))
  }

  private isActive(run: AdminSearchRun): boolean {
    return (
      (run.status === 'pending' || run.status === 'running') &&
      Date.now() - new Date(run.createdAt).getTime() < SEARCH_RUN_STALE_MS
    )
  }

  static present(row: AdminSearchRunDbRow): AdminSearchRun {
    const kind = row.kind as SearchRunKind
    const result = (typeof row.result === 'string' ? JSON.parse(row.result) : row.result) as Record<
      string,
      unknown
    > | null
    return {
      id: row.id,
      kind,
      status: row.status as SearchRunStatus,
      supplierId: row.supplier_id,
      supplierName: row.supplier_name,
      processed: row.processed,
      total: row.total,
      progress:
        row.total === null
          ? null
          : row.total === 0
            ? 100
            : Math.min(100, Math.round((row.processed / row.total) * 100)),
      evaluation: kind === 'evaluation' ? (result as SearchEvaluationSummary | null) : null,
      indexed: kind === 'reindex' && result ? Number(result.indexed ?? 0) : null,
      error: row.error,
      requestedBy: row.requested_by_email,
      createdAt: iso(row.created_at)!,
      startedAt: iso(row.started_at),
      finishedAt: iso(row.finished_at),
    }
  }
}
