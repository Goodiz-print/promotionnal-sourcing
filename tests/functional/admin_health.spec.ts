import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import Anthropic from '@anthropic-ai/sdk'
import aiConfig from '#config/ai'
import healthConfig from '#config/health'
import { UserFactory } from '#database/factories/user_factory'
import PlatformHealthAlert from '#mails/platform_health_alert'
import HealthMonitorService from '#services/health_monitor_service'
import { fakeClaudeClient } from '#tests/utils/fake_claude_client'
import { installFakeEngine } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'
import { useFakeStorage } from '#tests/utils/storage'
import {
  HEALTH_COMPONENTS,
  type HealthComponent,
  type PlatformHealthReport,
  type PlatformHealthSummary,
} from '#shared/types/admin_health'
import {
  QUEUE_DEFAULT_PRIORITY,
  QUEUE_PRIORITY_SCORE_MULTIPLIER,
  QUEUE_THRESHOLDS,
} from '#shared/types/health'

/**
 * Santé de la plateforme (#179). VIES et Mistral passent par `fetch` : il est remplacé
 * pour que la suite ne sorte jamais sur le réseau. Claude passe par le client
 * Anthropic, remplacé dans le conteneur par les tests qui le sondent.
 */
const realFetch = globalThis.fetch
let viesStatus = 200

function useIsolatedHealth(group: Parameters<typeof useDatabase>[0]) {
  const storage = useFakeStorage(group)
  const saved = { ...healthConfig }
  const savedKey = aiConfig.mistral.apiKey
  const savedClaudeKey = aiConfig.claude.apiKey

  group.each.setup(() => {
    viesStatus = 200
    globalThis.fetch = (async () =>
      new Response('{}', { status: viesStatus })) as unknown as typeof fetch
    healthConfig.token = undefined
    healthConfig.alertAddress = 'ops@example.test'
    aiConfig.mistral.apiKey = undefined
    aiConfig.claude.apiKey = undefined
    const { restore } = installFakeEngine(false)
    return () => {
      restore()
      Object.assign(healthConfig, saved)
      aiConfig.mistral.apiKey = savedKey
      aiConfig.claude.apiKey = savedClaudeKey
      globalThis.fetch = realFetch
    }
  })
  return storage
}

function details(client: ApiClient, token = 'secret-token') {
  return client.get('/health/details').header('Authorization', `Bearer ${token}`)
}

const statusOf = (report: PlatformHealthReport, component: HealthComponent) =>
  report.components.find((row) => row.component === component)!.status

test.group('Santé — point d’entrée détaillé', (group) => {
  useDatabase(group)
  const storage = useIsolatedHealth(group)

  test('n’existe pas sans jeton configuré, refuse un mauvais jeton, répond au bon', async ({
    client,
    assert,
  }) => {
    const r1 = await client.get('/health/details')
    r1.assertStatus(404)

    healthConfig.token = 'secret-token'
    const r2 = await client.get('/health/details')
    r2.assertStatus(401)
    const r3 = await client.get('/health/details').header('Authorization', 'Bearer wrong')
    r3.assertStatus(401)

    const response = await details(client)
    response.assertStatus(200)
    const report = response.body() as PlatformHealthReport
    assert.equal(report.status, 'ok')
    assert.deepEqual(
      report.components.map((row) => row.component),
      [...HEALTH_COMPONENTS]
    )
    // Recherche et Mistral ne sont pas configurés : non sondés, jamais en panne.
    assert.equal(statusOf(report, 'search'), 'disabled')
    assert.equal(statusOf(report, 'mistral'), 'disabled')
    assert.equal(statusOf(report, 'claude'), 'disabled')
  })

  test('un composant en panne fait répondre 503 au détail mais pas à la liveness', async ({
    client,
    assert,
  }) => {
    healthConfig.token = 'secret-token'
    const { engine } = installFakeEngine(true)
    engine.info = new Error('Meilisearch injoignable')

    const response = await details(client)
    response.assertStatus(503)
    const report = response.body() as PlatformHealthReport
    assert.equal(report.status, 'down')
    assert.equal(statusOf(report, 'search'), 'down')
    assert.equal(statusOf(report, 'database'), 'ok')

    // La liveness ne regarde que la base : le moteur muet ne la fait pas tomber.
    const liveness = await client.get('/health')
    liveness.assertStatus(200)
    assert.deepEqual(liveness.body(), { status: 'ok' })
  })

  test('Cellar injoignable, VIES en erreur et mails en échec sont distingués', async ({
    client,
    assert,
  }) => {
    healthConfig.token = 'secret-token'
    healthConfig.mailFailedThreshold = 2
    storage.driver.exists = async () => {
      throw new Error('Cellar indisponible')
    }
    viesStatus = 503
    await db.table('mail_deliveries').multiInsert(
      ['a', 'b'].map((key) => ({
        idempotency_key: key,
        kind: 'password-reset',
        to: `${key}@example.test`,
        status: 'failed',
        attempts: 6,
        error: 'boom',
        created_at: new Date(),
        updated_at: new Date(),
      }))
    )

    const response = await details(client)
    const report = response.body() as PlatformHealthReport

    assert.equal(statusOf(report, 'storage'), 'down')
    // VIES est un tiers : jamais plus que dégradé.
    assert.equal(statusOf(report, 'vies'), 'degraded')
    assert.equal(statusOf(report, 'mail'), 'degraded')
    assert.equal(report.status, 'down')
  })

  test('une queue sans consommateur est en panne, avec des jobs figés elle est dégradée', async ({
    client,
    assert,
  }) => {
    healthConfig.token = 'secret-token'
    const now = Date.now()
    const base = { queue: 'default', data: '{}' }
    await db.table('queue_jobs').insert({
      ...base,
      id: 'overdue',
      status: 'pending',
      execute_at: now - QUEUE_THRESHOLDS.pendingOverdueMs - 60_000,
      score: QUEUE_DEFAULT_PRIORITY * QUEUE_PRIORITY_SCORE_MULTIPLIER + now,
    })
    const fetchReport = async () => {
      const response = await details(client)
      return response.body() as PlatformHealthReport
    }
    assert.equal(statusOf(await fetchReport(), 'queue'), 'down')

    await db.from('queue_jobs').delete()
    await db.table('queue_jobs').insert({
      ...base,
      id: 'stuck',
      status: 'active',
      acquired_at: now - QUEUE_THRESHOLDS.activeStuckMs - 60_000,
      score: QUEUE_DEFAULT_PRIORITY * QUEUE_PRIORITY_SCORE_MULTIPLIER + now,
    })
    assert.equal(statusOf(await fetchReport(), 'queue'), 'degraded')
  })

  test('une clé Mistral refusée est en panne, une erreur 5xx est dégradée', async ({
    client,
    assert,
  }) => {
    healthConfig.token = 'secret-token'
    aiConfig.mistral.apiKey = 'sk-test'
    const fetchReport = async () => {
      const response = await details(client)
      return response.body() as PlatformHealthReport
    }

    globalThis.fetch = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch
    assert.equal(statusOf(await fetchReport(), 'mistral'), 'down')

    globalThis.fetch = (async () => new Response('{}', { status: 502 })) as unknown as typeof fetch
    assert.equal(statusOf(await fetchReport(), 'mistral'), 'degraded')

    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
    assert.equal(statusOf(await fetchReport(), 'mistral'), 'ok')

    // Injoignable (réseau, délai) : pas prouvé tombé, donc seulement dégradé.
    globalThis.fetch = (async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof fetch
    assert.equal(statusOf(await fetchReport(), 'mistral'), 'degraded')
  })
})

test.group('Santé — écran d’administration', (group) => {
  useDatabase(group)
  useIsolatedHealth(group)

  test('refuse tout rôle sans le droit ops.manage', async ({ client }) => {
    for (const state of ['platformModerator', 'platformSupport', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(state).create()
      const r4 = await client.get('/fr/admin/health').withInertia().loginAs(user)
      r4.assertStatus(403)
    }
  })

  test('affiche le rapport en direct et l’état conservé par la surveillance', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const monitor = await app.container.make(HealthMonitorService)
    await monitor.check()

    const response = await client.get('/fr/admin/health').withInertia().loginAs(admin)

    response.assertStatus(200)
    const { report, summary } = response.inertiaProps as {
      report: PlatformHealthReport
      summary: PlatformHealthSummary
    }
    assert.equal(report.status, 'ok')
    assert.lengthOf(report.components, HEALTH_COMPONENTS.length)
    assert.lengthOf(summary.components, HEALTH_COMPONENTS.length)
    assert.isNotNull(summary.checkedAt)
  })

  test('le tableau de bord porte la synthèse pour l’admin seulement', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const support = await UserFactory.apply('platformSupport').create()

    const asAdmin = await client.get('/fr/admin').withInertia().loginAs(admin)
    const asSupport = await client.get('/fr/admin').withInertia().loginAs(support)

    assert.isNotNull(asAdmin.inertiaProps.platform)
    assert.isNull(asSupport.inertiaProps.platform)
  })
})

test.group('Santé — surveillance et alertes', (group) => {
  useDatabase(group)
  const storage = useIsolatedHealth(group)

  let fakeMailer: ReturnType<typeof mail.fake>
  group.each.setup(() => {
    fakeMailer = mail.fake()
    return () => mail.restore()
  })
  const stateOf = async (component: HealthComponent) => {
    const service = await monitor()
    const summary = await service.summary()
    return summary.components.find((state) => state.component === component)!
  }
  const alerts = () => fakeMailer.mails.sent((sent) => sent instanceof PlatformHealthAlert)
  const monitor = () => app.container.make(HealthMonitorService)
  const breakStorage = (broken: boolean) => {
    storage.driver.exists = async () => {
      if (broken) throw new Error('Cellar indisponible')
      return false
    }
  }

  test('n’alerte qu’après des passes consécutives, une fois par incident, puis au rétablissement', async ({
    assert,
  }) => {
    healthConfig.alertAfterFailures = 2
    const service = await monitor()
    breakStorage(true)

    await service.check()
    assert.lengthOf(alerts(), 0)
    let summary = await service.summary()
    assert.equal(summary.components.find((c) => c.component === 'storage')!.consecutiveFailures, 1)

    await service.check()
    assert.lengthOf(alerts(), 1)
    await service.check()
    assert.lengthOf(alerts(), 1)
    summary = await service.summary()
    const storageState = summary.components.find((c) => c.component === 'storage')!
    assert.isTrue(storageState.alerted)
    assert.equal(storageState.status, 'down')
    assert.equal(summary.status, 'down')

    breakStorage(false)
    await service.check()
    assert.lengthOf(alerts(), 2)
    const recovered = await stateOf('storage')
    assert.isFalse(recovered.alerted)
    assert.equal(recovered.status, 'ok')
    assert.equal(recovered.consecutiveFailures, 0)
  })

  test('un raté isolé ne déclenche aucune alerte', async ({ assert }) => {
    healthConfig.alertAfterFailures = 2
    const service = await monitor()

    breakStorage(true)
    await service.check()
    breakStorage(false)
    await service.check()

    assert.lengthOf(alerts(), 0)
  })

  test('VIES, service tiers, n’alerte jamais', async ({ assert }) => {
    healthConfig.alertAfterFailures = 1
    viesStatus = 503
    const service = await monitor()

    await service.check()
    await service.check()

    assert.lengthOf(alerts(), 0)
    const vies = await stateOf('vies')
    assert.equal(vies.status, 'degraded')
  })

  test('sans adresse d’alerte, rien n’est envoyé mais l’état est tenu', async ({ assert }) => {
    healthConfig.alertAfterFailures = 1
    healthConfig.alertAddress = undefined
    const service = await monitor()
    breakStorage(true)

    await service.check()

    assert.lengthOf(alerts(), 0)
    const state = await stateOf('storage')
    assert.isTrue(state.alerted)
  })

  test('un incident qui s’aggrave est notifié à nouveau', async ({ assert }) => {
    healthConfig.alertAfterFailures = 1
    healthConfig.mailFailedThreshold = 1
    const service = await monitor()
    await db.table('mail_deliveries').insert({
      idempotency_key: 'k',
      kind: 'password-reset',
      to: 'k@example.test',
      status: 'failed',
      attempts: 6,
      error: 'boom',
      created_at: new Date(),
      updated_at: new Date(),
    })
    await service.check()
    assert.lengthOf(alerts(), 1)

    // Le mail reste dégradé ; la queue s'effondre : ce second incident est notifié.
    const now = Date.now()
    await db.table('queue_jobs').insert({
      id: 'overdue',
      queue: 'default',
      data: '{}',
      status: 'pending',
      execute_at: now - QUEUE_THRESHOLDS.pendingOverdueMs - 60_000,
      score: QUEUE_DEFAULT_PRIORITY * QUEUE_PRIORITY_SCORE_MULTIPLIER + now,
    })
    await service.check()
    assert.lengthOf(alerts(), 2)
  })

  test('la synthèse est vide tant que la surveillance n’a pas tourné', async ({ assert }) => {
    const service = await monitor()
    const summary = await service.summary()

    assert.isNull(summary.checkedAt)
    assert.lengthOf(summary.components, 0)
    assert.equal(summary.status, 'ok')
  })

  test('une alerte dont le mail échoue est rejouée à la passe suivante', async ({ assert }) => {
    healthConfig.alertAfterFailures = 1
    const service = await monitor()
    breakStorage(true)

    mail.send = (async () => {
      throw new Error('smtp down')
    }) as typeof mail.send
    try {
      await service.check()
    } finally {
      Reflect.deleteProperty(mail, 'send')
    }
    assert.lengthOf(alerts(), 0)
    const pending = await stateOf('storage')
    assert.isFalse(pending.alerted)

    await service.check()
    assert.lengthOf(alerts(), 1)
    const delivered = await stateOf('storage')
    assert.isTrue(delivered.alerted)
  })

  test('signale des états périmés quand la surveillance ne tourne plus', async ({ assert }) => {
    const service = await monitor()
    const now = new Date()
    await service.check(now)

    const fresh = await service.summary(new Date(now.getTime() + 5 * 60_000))
    const old = await service.summary(new Date(now.getTime() + 20 * 60_000))
    assert.isFalse(fresh.stale)
    assert.isTrue(old.stale)
  })

  test('une clé Claude refusée est en panne, une erreur 5xx ou réseau est dégradée', async ({
    client,
    assert,
    cleanup,
  }) => {
    healthConfig.token = 'secret-token'
    aiConfig.claude.apiKey = 'sk-ant-test'
    cleanup(() => app.container.restore(Anthropic))
    const statusWith = async (modelsError?: Error) => {
      app.container.swap(Anthropic, () => fakeClaudeClient({}, { modelsError }).client)
      const response = await details(client)
      return statusOf(response.body() as PlatformHealthReport, 'claude')
    }
    const apiError = (status: number) =>
      Anthropic.APIError.generate(status, undefined, `HTTP ${status}`, new Headers())

    assert.equal(await statusWith(), 'ok')
    assert.equal(await statusWith(apiError(401)), 'down')
    assert.equal(await statusWith(apiError(403)), 'down')
    assert.equal(await statusWith(apiError(529)), 'degraded')
    // Injoignable (réseau, délai) : pas prouvé tombé, donc seulement dégradé.
    assert.equal(await statusWith(new Anthropic.APIConnectionError({})), 'degraded')
  })
})
