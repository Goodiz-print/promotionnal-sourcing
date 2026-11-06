import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import HealthService from '#services/health_service'
import {
  QUEUE_DEFAULT_PRIORITY,
  QUEUE_PRIORITY_SCORE_MULTIPLIER,
  QUEUE_THRESHOLDS,
} from '#shared/types/health'
import { useDatabase } from '#tests/utils/setup'

/** Ligne de `queue_jobs` minimale ; les horodatages sont en millisecondes. */
function job(id: string, fields: Record<string, unknown>) {
  return { id, queue: 'default', data: '{}', ...fields }
}

test.group('Sonde de santé HTTP', (group) => {
  useDatabase(group)

  test('GET /health répond 200 quand la base est joignable', async ({ client, assert }) => {
    const response = await client.get('/health')
    response.assertStatus(200)
    assert.deepEqual(response.body(), { status: 'ok' })
  })
})

test.group('Sonde de santé de la queue', (group) => {
  useDatabase(group)

  test('un worker à jour est considéré sain', async ({ assert }) => {
    const now = Date.now()
    await db.table('queue_jobs').insert([
      job('fresh-pending', { status: 'pending', execute_at: now - 60_000 }),
      job('done', {
        status: 'completed',
        execute_at: now - 3_600_000,
        finished_at: now - 60_000,
      }),
    ])

    const report = await new HealthService().queueReport(new Date(now))

    assert.isTrue(report.ok)
    assert.equal(report.pendingOverdue, 0)
    assert.equal(report.stuckActive, 0)
  })

  test('un backlog en retard et un job figé rendent la queue dégradée', async ({ assert }) => {
    const now = Date.now()
    const overdue = now - QUEUE_THRESHOLDS.pendingOverdueMs - 60_000
    const stuckSince = now - QUEUE_THRESHOLDS.activeStuckMs - 60_000
    await db.table('queue_jobs').insert([
      job('overdue-1', { status: 'pending', execute_at: overdue }),
      job('overdue-2', { status: 'delayed', execute_at: overdue }),
      job('stuck', { status: 'active', execute_at: stuckSince, acquired_at: stuckSince }),
      job('failed', { status: 'failed', execute_at: now - 1000, finished_at: now - 3_600_000 }),
      job('old-failure', {
        status: 'failed',
        execute_at: now - 2 * 86_400_000,
        finished_at: now - 2 * 86_400_000,
      }),
    ])

    const report = await new HealthService().queueReport(new Date(now))

    assert.isFalse(report.ok)
    assert.equal(report.pendingOverdue, 2)
    assert.equal(report.stuckActive, 1)
    assert.equal(report.failedLast24h, 1)
    assert.equal(report.oldestPendingAgeMs, QUEUE_THRESHOLDS.pendingOverdueMs + 60_000)
  })

  test('un job pending sans échéance est daté de sa mise en file (score)', async ({ assert }) => {
    const now = Date.now()
    const enqueuedAt = now - QUEUE_THRESHOLDS.pendingOverdueMs - 120_000
    // Comme la lib : pas d'`execute_at` sur un job `pending`, la date est dans le score.
    await db.table('queue_jobs').insert([
      job('backlog', {
        status: 'pending',
        score: QUEUE_DEFAULT_PRIORITY * QUEUE_PRIORITY_SCORE_MULTIPLIER + enqueuedAt,
      }),
      job('recent', {
        status: 'pending',
        score: QUEUE_DEFAULT_PRIORITY * QUEUE_PRIORITY_SCORE_MULTIPLIER + now - 60_000,
      }),
    ])

    const report = await new HealthService().queueReport(new Date(now))

    assert.isFalse(report.ok)
    assert.equal(report.pendingOverdue, 1)
    assert.equal(report.oldestPendingAgeMs, QUEUE_THRESHOLDS.pendingOverdueMs + 120_000)
  })

  test('une queue vide est saine avec un âge du plus ancien nul', async ({ assert }) => {
    const report = await new HealthService().queueReport()

    assert.isTrue(report.ok)
    assert.isNull(report.oldestPendingAgeMs)
  })
})
