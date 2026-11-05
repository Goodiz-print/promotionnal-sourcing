import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import { useDatabase } from '#tests/utils/setup'
import type { AdminQueueJobRow, AdminQueueOverview } from '#shared/types/admin_queue'
import { QUEUE_THRESHOLDS } from '#shared/types/health'

/**
 * Supervision de la queue (#175). `QUEUE_DRIVER=sync` en test : un job planifié
 * lancé à la main s'exécute aussitôt, on ne lance donc que la purge du journal IA.
 * Les horodatages de `queue_jobs` sont en millisecondes.
 */
function job(id: string, fields: Record<string, unknown> = {}) {
  return {
    id,
    queue: 'default',
    status: 'pending',
    data: JSON.stringify({
      id,
      name: 'SendMailJob',
      payload: { to: 'a@example.test' },
      attempts: 0,
    }),
    score: 5 * 1e13 + Date.now(),
    ...fields,
  }
}

function post(client: any, user: unknown, url: string) {
  return client
    .post(url)
    .json({})
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
}

test.group('Queue — administration', (group) => {
  useDatabase(group)

  test('refuse l’accès sans le droit, y compris au support et à l’analyste', async ({
    client,
    assert,
  }) => {
    await db.table('queue_jobs').insert(job('j1', { status: 'failed', finished_at: Date.now() }))

    for (const state of ['platformModerator', 'platformSupport', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(state).create()
      const responses = [
        await client.get('/fr/admin/queue').withInertia().loginAs(user),
        await client.get('/fr/admin/queue/jobs/default/j1').withInertia().loginAs(user),
        await post(client, user, '/fr/admin/queue/jobs/default/j1/retry'),
        await post(client, user, '/fr/admin/queue/jobs/default/j1/cancel'),
        await post(client, user, '/fr/admin/queue/schedules/purge-ai-calls/run'),
      ]
      for (const response of responses) response.assertStatus(403)
    }
    const kept = await db.from('queue_jobs').where('id', 'j1').firstOrFail()
    assert.equal(kept.status, 'failed')
  })

  test('affiche la santé, les effectifs par état et les jobs', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const now = Date.now()
    await db.table('queue_jobs').multiInsert([
      job('overdue', {
        status: 'delayed',
        score: null,
        execute_at: now - QUEUE_THRESHOLDS.pendingOverdueMs - 60_000,
      }),
      job('stuck', {
        status: 'active',
        score: null,
        acquired_at: now - QUEUE_THRESHOLDS.activeStuckMs - 60_000,
      }),
      job('failed', { status: 'failed', score: null, finished_at: now, error: 'boom\nstack…' }),
    ])

    const response = await client.get('/fr/admin/queue').withInertia().loginAs(admin)

    response.assertStatus(200)
    const overview = response.inertiaProps.overview as AdminQueueOverview
    assert.isFalse(overview.health.ok)
    assert.equal(overview.health.pendingOverdue, 1)
    assert.equal(overview.health.stuckActive, 1)
    assert.equal(overview.health.failedLast24h, 1)
    assert.equal(overview.counts.failed, 1)
    assert.equal(overview.counts.delayed, 1)
    assert.equal(overview.counts.pending, 0)

    const rows = (response.inertiaProps.jobs as { data: AdminQueueJobRow[] }).data
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]))
    assert.isTrue(byId.overdue.overdue)
    assert.isTrue(byId.stuck.stuck)
    assert.isFalse(byId.stuck.cancellable)
    assert.equal(byId.failed.error, 'boom')
    assert.isTrue(byId.failed.retryable)
    assert.equal(byId.failed.name, 'SendMailJob')
  })

  test('filtre par état, par job bloqué et par nom', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const now = Date.now()
    await db.table('queue_jobs').multiInsert([
      job('p1'),
      job('stuck', {
        status: 'active',
        score: null,
        acquired_at: now - QUEUE_THRESHOLDS.activeStuckMs - 60_000,
      }),
      job('fresh', { status: 'active', score: null, acquired_at: now }),
      job('other', {
        data: JSON.stringify({ id: 'other', name: 'ExpireRfqsJob', payload: {}, attempts: 0 }),
      }),
    ])
    const ids = async (qs: string) => {
      const response = await client.get(`/fr/admin/queue?${qs}`).withInertia().loginAs(admin)
      const { data } = response.inertiaProps.jobs as { data: AdminQueueJobRow[] }
      return data.map((row) => row.id).sort()
    }

    assert.deepEqual(await ids('status=stuck'), ['stuck'])
    assert.deepEqual(await ids('status=active'), ['fresh', 'stuck'])
    assert.deepEqual(await ids('name=expire'), ['other'])
    assert.deepEqual(await ids('status=pending&name=SendMail'), ['p1'])
  })

  test('la fiche montre l’erreur et la charge utile, tronquées', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await db
      .table('queue_jobs')
      .insert(job('big', { status: 'failed', score: null, error: 'x'.repeat(10_000) }))

    const response = await client
      .get('/fr/admin/queue/jobs/default/big')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const detail = response.inertiaProps.job as { fullError: string; payload: string; name: string }
    assert.equal(detail.name, 'SendMailJob')
    assert.include(detail.payload, 'a@example.test')
    assert.isAtMost(detail.fullError.length, 4001)

    const missing = await client
      .get('/fr/admin/queue/jobs/default/nope')
      .withInertia()
      .loginAs(admin)
    missing.assertStatus(404)
  })

  test('relance un job échoué : de nouveau en attente, essais remis à zéro, tracé', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await db.table('queue_jobs').insert(
      job('f1', {
        status: 'failed',
        score: null,
        finished_at: Date.now(),
        error: 'boom',
        data: JSON.stringify({ id: 'f1', name: 'SendMailJob', payload: {}, attempts: 3 }),
      })
    )

    const response = await post(client, admin, '/fr/admin/queue/jobs/default/f1/retry')

    response.assertStatus(302)
    const row = await db.from('queue_jobs').where('id', 'f1').first()
    assert.equal(row.status, 'pending')
    assert.isNull(row.error)
    assert.isNull(row.finished_at)
    assert.isNotNull(row.score)
    assert.equal(JSON.parse(row.data).attempts, 0)

    const audit = await AdminAuditLog.query().where('action', 'queue_job.retried').firstOrFail()
    assert.equal(audit.changes?.after?.jobId, 'f1')
    assert.equal(audit.actorUserId, admin.id)
  })

  test('refuse de relancer un job qui n’est pas échoué', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await db.table('queue_jobs').insert(job('p1'))

    await post(client, admin, '/fr/admin/queue/jobs/default/p1/retry')

    const kept = await db.from('queue_jobs').where('id', 'p1').firstOrFail()
    assert.equal(kept.status, 'pending')
    assert.lengthOf(await AdminAuditLog.query().where('action', 'queue_job.retried'), 0)
  })

  test('annule un job en attente ou échoué, jamais un job actif', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await db
      .table('queue_jobs')
      .multiInsert([
        job('p1'),
        job('f1', { status: 'failed', score: null, finished_at: Date.now() }),
        job('a1', { status: 'active', score: null, acquired_at: Date.now() }),
      ])

    for (const id of ['p1', 'f1', 'a1']) {
      await post(client, admin, `/fr/admin/queue/jobs/default/${id}/cancel`)
    }

    const left = await db.from('queue_jobs').select('id')
    assert.deepEqual(
      left.map((row) => row.id),
      ['a1']
    )
    assert.lengthOf(await AdminAuditLog.query().where('action', 'queue_job.cancelled'), 2)
  })

  test('liste les jobs planifiés et lance à la main ceux qui le permettent', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await db.table('queue_schedules').multiInsert([
      {
        id: 'purge-ai-calls',
        name: 'PurgeAiCallsJob',
        payload: '{}',
        cron_expression: '20 4 * * *',
        timezone: 'Europe/Paris',
        run_count: 4,
        last_run_at: Date.now() - 3600_000,
        next_run_at: Date.now() + 3600_000,
        created_at: Date.now(),
      },
      {
        id: 'custom',
        name: 'CustomJob',
        payload: '{}',
        every_ms: 60_000,
        timezone: 'UTC',
        created_at: Date.now(),
      },
    ])

    const page = await client.get('/fr/admin/queue').withInertia().loginAs(admin)
    const schedules = (page.inertiaProps.overview as AdminQueueOverview).schedules
    assert.deepEqual(
      schedules.map((s) => [s.id, s.runnable, s.runCount]),
      [
        ['custom', false, 0],
        ['purge-ai-calls', true, 4],
      ]
    )

    const ran = await post(client, admin, '/fr/admin/queue/schedules/purge-ai-calls/run')
    ran.assertStatus(302)
    const audit = await AdminAuditLog.query().where('action', 'queue_schedule.run').firstOrFail()
    assert.equal(audit.changes?.after?.schedule, 'purge-ai-calls')

    // Planning inconnu de la liste blanche ou absent : refusé, rien n'est tracé.
    await post(client, admin, '/fr/admin/queue/schedules/custom/run')
    await post(client, admin, '/fr/admin/queue/schedules/inconnu/run')
    assert.lengthOf(await AdminAuditLog.query().where('action', 'queue_schedule.run'), 1)
  })

  test('le tableau de bord porte la santé de la queue pour l’admin seulement', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const analyst = await UserFactory.apply('platformAnalyst').create()

    const asAdmin = await client.get('/fr/admin').withInertia().loginAs(admin)
    const asAnalyst = await client.get('/fr/admin').withInertia().loginAs(analyst)

    assert.isTrue((asAdmin.inertiaProps.queue as { ok: boolean }).ok)
    assert.isNull(asAnalyst.inertiaProps.queue)
  })
})
