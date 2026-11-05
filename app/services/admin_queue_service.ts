import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import PurgeActivityEventsJob from '#jobs/purge_activity_events_job'
import PurgeAiCallsJob from '#jobs/purge_ai_calls_job'
import PurgeExpiredInvitationsJob from '#jobs/purge_expired_invitations_job'
import PurgeSearchEventsJob from '#jobs/purge_search_events_job'
import RecoverStorageUploadsJob from '#jobs/recover_storage_uploads_job'
import RemindRfqSuppliersJob from '#jobs/remind_rfq_suppliers_job'
import ExpireRfqsJob from '#jobs/expire_rfqs_job'
import AdminAuditService from '#services/admin_audit_service'
import HealthService from '#services/health_service'
import { AdminQueueJobNotFoundException } from '#exceptions/admin_errors'
import {
  QUEUE_DETAIL_MAX_LENGTH,
  QUEUE_ERROR_SUMMARY_LENGTH,
  QUEUE_JOB_STATUSES,
  type AdminQueueFilters,
  type AdminQueueJobDbRow,
  type AdminQueueJobDetail,
  type AdminQueueJobRow,
  type AdminQueueOverview,
  type AdminQueueScheduleRow,
  type QueueJobStatus,
} from '#shared/types/admin_queue'
import type { AdminActionContext } from '#shared/types/admin_audit'
import { QUEUE_THRESHOLDS } from '#shared/types/health'
import type { Paginated } from '#shared/types/pagination'

/** Priorité par défaut de @boringnode/queue et pondération du score (priorité × 1e13 + date). */
const DEFAULT_PRIORITY = 5
const PRIORITY_SCORE_MULTIPLIER = 1e13

/** États dont l'annulation est sûre : un job `active` est tenu par un worker. */
const CANCELLABLE_STATUSES: readonly QueueJobStatus[] = ['pending', 'delayed', 'failed']

/**
 * Jobs planifiés (`start/scheduler.ts`) qu'un admin peut lancer à la main : des
 * tâches de maintenance idempotentes, sans charge utile. Un planning absent de
 * cette liste s'affiche mais ne se lance pas.
 */
const MANUAL_RUNS: Record<string, () => PromiseLike<unknown>> = {
  'purge-expired-invitations': () => PurgeExpiredInvitationsJob.dispatch({}),
  'recover-storage-uploads': () => RecoverStorageUploadsJob.dispatch({}),
  'expire-rfqs': () => ExpireRfqsJob.dispatch({}),
  'remind-rfq-suppliers': () => RemindRfqSuppliersJob.dispatch({}),
  'purge-search-events': () => PurgeSearchEventsJob.dispatch({}),
  'purge-activity-events': () => PurgeActivityEventsJob.dispatch({}),
  'purge-ai-calls': () => PurgeAiCallsJob.dispatch({}),
}

const contains = (term: string) => `%${term.replace(/[\\%_]/g, '\\$&')}%`
const toIso = (value: string | number | null): string | null =>
  value === null || value === undefined ? null : new Date(Number(value)).toISOString()
const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}…` : value
const summarize = (error: string | null) =>
  error ? truncate(error.split('\n')[0], QUEUE_ERROR_SUMMARY_LENGTH) : null

/**
 * Supervision de la queue vue du back-office (#175) : santé (via `HealthService`,
 * mêmes seuils que `node ace queue:health`), jobs, relance / annulation et
 * planning. Accès par `db` : les tables appartiennent à `@adonisjs/queue`.
 * Les horodatages de `queue_jobs` sont en millisecondes.
 */
@inject()
export default class AdminQueueService {
  constructor(
    private health: HealthService,
    private audit: AdminAuditService
  ) {}

  async overview(): Promise<AdminQueueOverview> {
    const [health, counts, schedules] = await Promise.all([
      this.health.queueReport(),
      this.counts(),
      this.schedules(),
    ])
    return { health, counts, schedules }
  }

  async list(
    filters: AdminQueueFilters & { page: number; perPage: number }
  ): Promise<Paginated<AdminQueueJobRow>> {
    const query = db
      .from('queue_jobs')
      .select(
        'id',
        'queue',
        'status',
        'acquired_at',
        'execute_at',
        'finished_at',
        db.raw("(data::jsonb ->> 'name') as name"),
        db.raw("coalesce((data::jsonb ->> 'attempts')::int, 0) as attempts"),
        db.raw('score % ? as enqueued_at', [PRIORITY_SCORE_MULTIPLIER]),
        db.raw('left(error, ?) as error', [QUEUE_ERROR_SUMMARY_LENGTH * 4])
      )

    if (filters.status === 'stuck') {
      query
        .where('status', 'active')
        .where('acquired_at', '<=', Date.now() - QUEUE_THRESHOLDS.activeStuckMs)
    } else if (filters.status) {
      query.where('status', filters.status)
    }
    if (filters.name) query.whereRaw("(data::jsonb ->> 'name') ILIKE ?", [contains(filters.name)])

    const paginator = await query
      .orderByRaw('coalesce(finished_at, acquired_at, execute_at, score % ?) desc nulls last', [
        PRIORITY_SCORE_MULTIPLIER,
      ])
      .orderBy('id', 'asc')
      .paginate(filters.page, filters.perPage)

    const { data, meta } = paginator.toJSON()
    return {
      data: data.map((row: AdminQueueJobDbRow) => this.present(row)),
      meta: {
        total: meta.total,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
      },
    }
  }

  async show(queue: string, id: string): Promise<AdminQueueJobDetail> {
    const row = await db
      .from('queue_jobs')
      .where({ queue, id })
      .select(
        'id',
        'queue',
        'status',
        'worker_id',
        'acquired_at',
        'execute_at',
        'finished_at',
        'error',
        'data',
        db.raw('score % ? as enqueued_at', [PRIORITY_SCORE_MULTIPLIER])
      )
      .first()
    if (!row) throw new AdminQueueJobNotFoundException()

    const data = this.parseData(row.data)
    const base = this.present({
      ...row,
      name: typeof data.name === 'string' ? data.name : null,
      attempts: typeof data.attempts === 'number' ? data.attempts : 0,
    })
    return {
      ...base,
      workerId: row.worker_id,
      acquiredAt: toIso(row.acquired_at),
      executeAt: toIso(row.execute_at),
      finishedAt: toIso(row.finished_at),
      payload: truncate(JSON.stringify(data.payload ?? null, null, 2), QUEUE_DETAIL_MAX_LENGTH),
      fullError: row.error ? truncate(row.error, QUEUE_DETAIL_MAX_LENGTH) : null,
    }
  }

  /**
   * Remet un job échoué en file, avec ses compteurs d'essais remis à zéro.
   * `false` si le job n'existe plus ou n'est plus `failed` (un autre admin vient
   * de le relancer, ou le worker l'a repris).
   */
  async retry(queue: string, id: string, context: AdminActionContext): Promise<boolean> {
    return db.transaction(async (trx) => {
      const row = await trx
        .from('queue_jobs')
        .where({ queue, id, status: 'failed' })
        .forUpdate()
        .select('data')
        .first()
      if (!row) return false

      const data = this.parseData(row.data)
      const priority = typeof data.priority === 'number' ? data.priority : DEFAULT_PRIORITY
      await trx
        .from('queue_jobs')
        .where({ queue, id })
        .update({
          status: 'pending',
          data: JSON.stringify({ ...data, attempts: 0 }),
          score: priority * PRIORITY_SCORE_MULTIPLIER + Date.now(),
          error: null,
          worker_id: null,
          acquired_at: null,
          execute_at: null,
          finished_at: null,
        })

      await this.recordJob('queue_job.retried', queue, id, data, context, trx)
      return true
    })
  }

  /** Supprime un job en attente, différé ou échoué. `false` s'il n'est plus annulable. */
  async cancel(queue: string, id: string, context: AdminActionContext): Promise<boolean> {
    return db.transaction(async (trx) => {
      const row = await trx
        .from('queue_jobs')
        .where({ queue, id })
        .whereIn('status', [...CANCELLABLE_STATUSES])
        .forUpdate()
        .select('data')
        .first()
      if (!row) return false

      await trx.from('queue_jobs').where({ queue, id }).delete()
      await this.recordJob('queue_job.cancelled', queue, id, this.parseData(row.data), context, trx)
      return true
    })
  }

  /**
   * Lance un job planifié hors de son horaire. `false` si le planning est
   * inconnu ou ne se lance pas à la main. N'altère pas le planning (prochain
   * passage, compteur).
   */
  async runSchedule(scheduleId: string, context: AdminActionContext): Promise<boolean> {
    const run = MANUAL_RUNS[scheduleId]
    if (!run) return false

    const schedule = await db
      .from('queue_schedules')
      .where('id', scheduleId)
      .whereNot('status', 'cancelled')
      .select('name')
      .first()
    if (!schedule) return false

    await db.transaction(async (trx) => {
      await this.audit.record(
        {
          action: 'queue_schedule.run',
          targetType: 'queue_schedule',
          targetId: null,
          changes: { after: { schedule: scheduleId, job: schedule.name } },
        },
        { ...context, client: trx }
      )
      await run()
    })
    return true
  }

  private async counts(): Promise<Record<QueueJobStatus, number>> {
    const rows = await db.from('queue_jobs').select('status').count('* as total').groupBy('status')
    const counts = Object.fromEntries(QUEUE_JOB_STATUSES.map((status) => [status, 0])) as Record<
      QueueJobStatus,
      number
    >
    for (const row of rows) {
      if (row.status in counts) counts[row.status as QueueJobStatus] = Number(row.total)
    }
    return counts
  }

  private async schedules(): Promise<AdminQueueScheduleRow[]> {
    const rows = await db
      .from('queue_schedules')
      .whereNot('status', 'cancelled')
      .select(
        'id',
        'name',
        'cron_expression',
        'every_ms',
        'timezone',
        'status',
        'run_count',
        'last_run_at',
        'next_run_at'
      )
      .orderBy('id', 'asc')

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      cron: row.cron_expression,
      everyMs: row.every_ms === null ? null : Number(row.every_ms),
      timezone: row.timezone,
      status: row.status,
      runCount: Number(row.run_count),
      lastRunAt: toIso(row.last_run_at),
      nextRunAt: toIso(row.next_run_at),
      runnable: row.id in MANUAL_RUNS,
    }))
  }

  private present(row: AdminQueueJobDbRow): AdminQueueJobRow {
    const now = Date.now()
    const status = row.status as QueueJobStatus
    const acquiredAt = row.acquired_at === null ? null : Number(row.acquired_at)
    const executeAt = row.execute_at === null ? null : Number(row.execute_at)
    const enqueuedAt = row.enqueued_at === null ? null : Number(row.enqueued_at)
    // Un job `pending` n'a pas d'échéance : son ancienneté est sa date de mise en file.
    const dueAt = status === 'pending' ? enqueuedAt : executeAt

    const at =
      status === 'completed' || status === 'failed'
        ? row.finished_at
        : status === 'active'
          ? row.acquired_at
          : (dueAt ?? row.execute_at)

    return {
      id: row.id,
      queue: row.queue,
      name: row.name ?? '—',
      status,
      attempts: Number(row.attempts ?? 0),
      at: toIso(at),
      stuck:
        status === 'active' &&
        acquiredAt !== null &&
        acquiredAt <= now - QUEUE_THRESHOLDS.activeStuckMs,
      overdue:
        (status === 'pending' || status === 'delayed') &&
        dueAt !== null &&
        dueAt <= now - QUEUE_THRESHOLDS.pendingOverdueMs,
      error: summarize(row.error),
      retryable: status === 'failed',
      cancellable: CANCELLABLE_STATUSES.includes(status),
    }
  }

  private parseData(raw: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(raw)
      return parsed !== null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }

  private recordJob(
    action: 'queue_job.retried' | 'queue_job.cancelled',
    queue: string,
    id: string,
    data: Record<string, unknown>,
    context: AdminActionContext,
    client: TransactionClientContract
  ) {
    return this.audit.record(
      {
        action,
        targetType: 'queue_job',
        targetId: null,
        changes: {
          after: { jobId: id, queue, job: typeof data.name === 'string' ? data.name : null },
        },
      },
      { ...context, client }
    )
  }
}
