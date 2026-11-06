import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import {
  QUEUE_PRIORITY_SCORE_MULTIPLIER,
  QUEUE_THRESHOLDS,
  type QueueHealthReport,
} from '#shared/types/health'

/**
 * Sondes de santé (#61). Accès par `db` uniquement : pas de modèle Lucid, la
 * table `queue_jobs` appartient à `@adonisjs/queue`.
 */
@inject()
export default class HealthService {
  /** Vrai si la base répond. Ne lève jamais : la sonde HTTP doit répondre 503. */
  async databaseReachable(): Promise<boolean> {
    try {
      await db.rawQuery('select 1')
      return true
    } catch {
      return false
    }
  }

  /**
   * Rapport de la queue. Lève si la base est injoignable (le caller décide).
   * Les horodatages de `queue_jobs` sont en millisecondes. Un job `pending` n'a
   * pas d'`execute_at` : son échéance est sa date de mise en file, dérivée du score.
   */
  async queueReport(now: Date = new Date()): Promise<QueueHealthReport> {
    const nowMs = now.getTime()
    const overdueBefore = nowMs - QUEUE_THRESHOLDS.pendingOverdueMs
    const stuckBefore = nowMs - QUEUE_THRESHOLDS.activeStuckMs
    const failedSince = nowMs - QUEUE_THRESHOLDS.failedWindowMs

    const due = 'coalesce(execute_at, score % ?)'
    const result = await db.rawQuery(
      `select
         count(*) filter (where status in ('pending', 'delayed') and ${due} <= ?) as overdue,
         min(${due}) filter (where status in ('pending', 'delayed') and ${due} <= ?) as oldest,
         count(*) filter (where status = 'active' and acquired_at <= ?) as stuck,
         count(*) filter (where status = 'failed' and finished_at >= ?) as failed
       from queue_jobs`,
      [
        QUEUE_PRIORITY_SCORE_MULTIPLIER,
        overdueBefore,
        QUEUE_PRIORITY_SCORE_MULTIPLIER,
        QUEUE_PRIORITY_SCORE_MULTIPLIER,
        overdueBefore,
        stuckBefore,
        failedSince,
      ]
    )
    const row = result.rows[0]
    const pendingOverdue = Number(row.overdue)
    const stuckActive = Number(row.stuck)
    const oldest = row.oldest === null ? null : Number(row.oldest)

    return {
      ok: pendingOverdue === 0 && stuckActive === 0,
      pendingOverdue,
      oldestPendingAgeMs: oldest === null ? null : nowMs - oldest,
      stuckActive,
      failedLast24h: Number(row.failed),
      checkedAt: now.toISOString(),
    }
  }
}
