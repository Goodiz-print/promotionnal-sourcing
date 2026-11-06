import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import AdminSearchService from '#services/admin_search_service'
import ProductIndexService from '#services/product_index_service'
import SearchEvaluationService from '#services/search/search_evaluation_service'
import FakeSearchEngine, { installFakeEngine } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'
import {
  SEARCH_RUN_STALE_MS,
  type AdminSearchDrift,
  type AdminSearchOverview,
} from '#shared/types/admin_search'
import type { SearchEvaluationReport } from '#shared/types/search'

/**
 * État de la recherche (#176). Le moteur est un double (`FakeSearchEngine`) ;
 * `QUEUE_DRIVER=sync` en test : une opération mise en file est donc exécutée
 * dans la requête, ce qui permet de vérifier son avancement et son résultat.
 */
function post(client: any, user: unknown, url: string, body: object = {}) {
  return client
    .post(url)
    .json(body)
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
}

/** Active la recherche le temps d'un test, avec un moteur factice. */
function useFakeEngine(group: Parameters<typeof useDatabase>[0], enabled = true) {
  const state = { engine: new FakeSearchEngine() }
  group.each.setup(() => {
    const handle = installFakeEngine(enabled)
    state.engine = handle.engine
    return () => handle.restore()
  })
  return state
}

const overviewOf = (response: { inertiaProps: Record<string, unknown> }) =>
  response.inertiaProps.overview as AdminSearchOverview

test.group('Recherche — droits', (group) => {
  useDatabase(group)

  test('refuse l’accès sans le droit, y compris au support et au modérateur', async ({
    client,
  }) => {
    for (const state of ['platformModerator', 'platformSupport', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(state).create()
      const index = await client.get('/fr/admin/search').withInertia().loginAs(user)
      const reindex = await post(client, user, '/fr/admin/search/reindex')
      const evaluate = await post(client, user, '/fr/admin/search/evaluate')
      for (const response of [index, reindex, evaluate]) response.assertStatus(403)
    }
  })
})

test.group('Recherche — état du moteur', (group) => {
  useDatabase(group)
  const fake = useFakeEngine(group, false)

  test('moteur inerte : alerte « désactivée », aucune opération possible', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

    response.assertStatus(200)
    response.assertInertiaComponent('admin/search/index')
    const overview = overviewOf(response)
    assert.equal(overview.status.state, 'disabled')
    assert.isNull(overview.status.info)
    assert.isFalse(overview.active)
    // L’écart n’est calculé qu’à la demande.
    assert.isUndefined(response.inertiaProps.drift)

    await post(client, admin, '/fr/admin/search/reindex')
    await post(client, admin, '/fr/admin/search/evaluate')
    assert.equal((await db.from('search_runs').count('* as n').first())!.n, '0')
    assert.deepEqual(fake.engine.replaced, [])
  })

  test('moteur actif : documents, écritures et tâches récentes', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const handle = installFakeEngine(true)
    handle.engine.info = {
      indexExists: true,
      documents: 42,
      indexing: true,
      tasks: [
        {
          uid: 7,
          type: 'documentAdditionOrUpdate',
          status: 'failed',
          enqueuedAt: '2026-11-06T10:00:00.000Z',
          finishedAt: '2026-11-06T10:00:02.000Z',
          error: 'boom',
        },
      ],
    }
    try {
      const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

      const { status } = overviewOf(response)
      assert.equal(status.state, 'ready')
      assert.equal(status.info!.documents, 42)
      assert.isTrue(status.info!.indexing)
      assert.equal(status.info!.tasks[0].error, 'boom')
    } finally {
      handle.restore()
    }
  })

  test('moteur injoignable : l’écran s’affiche avec l’alerte et le message', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const handle = installFakeEngine(true)
    handle.engine.info = new Error('fetch failed')
    try {
      const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

      response.assertStatus(200)
      const { status } = overviewOf(response)
      assert.equal(status.state, 'unreachable')
      assert.equal(status.error, 'fetch failed')
      assert.isNull(status.info)
    } finally {
      handle.restore()
    }
  })

  test('le tableau de bord signale la recherche inerte, selon le droit', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const analyst = await UserFactory.apply('platformAnalyst').create()

    const forAdmin = await client.get('/fr/admin').withInertia().loginAs(admin)
    const forAnalyst = await client.get('/fr/admin').withInertia().loginAs(analyst)

    assert.isTrue(forAdmin.inertiaProps.searchDisabled as boolean)
    assert.isFalse(forAnalyst.inertiaProps.searchDisabled as boolean)

    const handle = installFakeEngine(true)
    try {
      const active = await client.get('/fr/admin').withInertia().loginAs(admin)
      assert.isFalse(active.inertiaProps.searchDisabled as boolean)
    } finally {
      handle.restore()
    }
  })
})

test.group('Recherche — écart PostgreSQL ↔ index', (group) => {
  useDatabase(group, { seed: 'full' })
  const fake = useFakeEngine(group)

  async function visibleIds() {
    const index = await app.container.make(ProductIndexService)
    const ids: number[] = []
    for await (const batch of index.visibleProductIds()) ids.push(...batch)
    return ids
  }

  test('liste les produits manquants dans l’index et ceux en trop', async ({ assert }) => {
    const visible = await visibleIds()
    assert.isAbove(visible.length, 1)
    fake.engine.indexedDocumentIds = [...visible.slice(1), 999_999]

    const service = await app.container.make(AdminSearchService)
    const drift = await service.drift()

    assert.equal(drift!.expected, visible.length)
    assert.equal(drift!.indexed, visible.length)
    assert.deepEqual(drift!.missing, [visible[0]])
    assert.equal(drift!.missingCount, 1)
    assert.deepEqual(drift!.extra, [999_999])
    assert.equal(drift!.extraCount, 1)
  })

  test('index identique à PostgreSQL : aucun écart', async ({ assert }) => {
    fake.engine.indexedDocumentIds = await visibleIds()

    const service = await app.container.make(AdminSearchService)
    const drift = await service.drift()

    assert.equal(drift!.missingCount, 0)
    assert.equal(drift!.extraCount, 0)
  })

  test('moteur injoignable ou inerte : pas d’écart calculable', async ({ assert }) => {
    fake.engine.indexedDocumentIds = new Error('down')
    const service = await app.container.make(AdminSearchService)
    assert.isNull(await service.drift())

    fake.engine.enabled = false
    assert.isNull(await service.drift())
  })

  test('l’écart est calculé à la demande (rechargement partiel)', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    fake.engine.indexedDocumentIds = await visibleIds()

    const response = await client
      .get('/fr/admin/search')
      .withInertia()
      .header('X-Inertia-Partial-Component', 'admin/search/index')
      .header('X-Inertia-Partial-Data', 'drift')
      .loginAs(admin)

    response.assertStatus(200)
    assert.equal((response.inertiaProps.drift as AdminSearchDrift).missingCount, 0)
  })
})

test.group('Recherche — réindexation', (group) => {
  useDatabase(group, { seed: 'full' })
  const fake = useFakeEngine(group)

  test('reconstruit l’index : avancement, résultat et audit', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    await post(client, admin, '/fr/admin/search/reindex')

    const run = await db.from('search_runs').first()
    assert.equal(run.kind, 'reindex')
    assert.equal(run.status, 'completed')
    assert.isNull(run.supplier_id)
    assert.isAbove(run.total, 0)
    assert.equal(run.processed, run.total)
    assert.isAbove(run.result.indexed, 0)
    assert.isNotNull(run.started_at)
    assert.isNotNull(run.finished_at)
    assert.equal(run.requested_by_email, admin.email)
    assert.isAbove(fake.engine.replaced.flat().length, 0)

    const logs = await AdminAuditLog.query().where('action', 'search.reindex_requested')
    assert.lengthOf(logs, 1)
    assert.equal(logs[0].targetType, 'search_run')
    assert.equal(logs[0].targetId, run.id)
    assert.equal(logs[0].actorUserId, admin.id)
  })

  test('l’historique expose l’avancement de la dernière opération', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await post(client, admin, '/fr/admin/search/reindex')

    const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

    const [run] = overviewOf(response).reindexRuns
    assert.equal(run.status, 'completed')
    assert.equal(run.progress, 100)
    assert.isAbove(run.indexed!, 0)
    assert.isFalse(overviewOf(response).active)
  })

  test('limitée à un fournisseur : seuls ses produits sont réindexés', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const row = await db
      .from('products')
      .join('suppliers', 'suppliers.id', 'products.supplier_id')
      .select('suppliers.id as supplier_id', 'suppliers.name as supplier_name')
      .first()
    const supplierProducts = await db.from('products').where('supplier_id', row.supplier_id)

    await post(client, admin, '/fr/admin/search/reindex', { supplierId: row.supplier_id })

    const run = await db.from('search_runs').first()
    assert.equal(run.status, 'completed')
    assert.equal(run.supplier_id, row.supplier_id)
    assert.equal(run.supplier_name, row.supplier_name)
    assert.equal(run.total, supplierProducts.length)
    // Pas de reconstruction complète : écritures ciblées seulement.
    assert.lengthOf(fake.engine.replaced, 0)
    const touched = new Set([...fake.engine.indexedIds, ...fake.engine.removed.flat()])
    for (const product of supplierProducts) assert.isTrue(touched.has(product.id))
  })

  test('fournisseur inconnu : refusé, rien n’est créé', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()

    await post(client, admin, '/fr/admin/search/reindex', { supplierId: 999_999 })

    assert.equal((await db.from('search_runs').count('* as n').first())!.n, '0')
    assert.lengthOf(await AdminAuditLog.query().where('action', 'search.reindex_requested'), 0)
  })

  test('une réindexation en cours en bloque une seconde, sauf si elle est périmée', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await db.table('search_runs').insert({
      kind: 'reindex',
      status: 'running',
      processed: 10,
      total: 100,
      created_at: new Date(),
    })

    await post(client, admin, '/fr/admin/search/reindex')
    assert.equal((await db.from('search_runs').count('* as n').first())!.n, '1')
    assert.lengthOf(fake.engine.replaced, 0)

    // Worker tué en route : l’opération « en cours » ne bloque plus au-delà du délai.
    await db
      .from('search_runs')
      .update({ created_at: new Date(Date.now() - SEARCH_RUN_STALE_MS - 60_000) })
    await post(client, admin, '/fr/admin/search/reindex')
    assert.equal((await db.from('search_runs').count('* as n').first())!.n, '2')
  })

  test('un échec du moteur est conservé sur l’opération, sans planter la requête', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    fake.engine.replaceAll = async () => {
      throw new Error('boom')
    }

    const response = await post(client, admin, '/fr/admin/search/reindex')

    response.assertStatus(302)
    const run = await db.from('search_runs').first()
    assert.equal(run.status, 'failed')
    assert.equal(run.error, 'boom')
    assert.isNotNull(run.finished_at)
  })

  test('rejouer une opération déjà prise en charge est sans effet', async ({ assert }) => {
    const [created] = await db
      .table('search_runs')
      .insert({
        kind: 'reindex',
        status: 'completed',
        processed: 3,
        total: 3,
        created_at: new Date(),
      })
      .returning('id')

    const service = await app.container.make(AdminSearchService)
    await service.execute(created.id)

    const run = await db.from('search_runs').where('id', created.id).first()
    assert.lengthOf(fake.engine.replaced, 0)
    assert.equal(run.status, 'completed')
  })
})

test.group('Recherche — évaluation', (group) => {
  useDatabase(group)
  useFakeEngine(group)

  const report: SearchEvaluationReport = {
    results: [
      {
        id: 'q1',
        kind: 'keyword',
        query: 'stylo',
        status: 'passed',
        recallAt10: 1,
        returned: ['a'],
        missing: [],
        unexpected: [],
        latencyMs: 12,
      },
      {
        id: 'q2',
        kind: 'semantic',
        query: 'cadeau écolo',
        status: 'failed',
        recallAt10: 0.5,
        returned: ['b'],
        missing: ['c'],
        unexpected: ['b'],
        latencyMs: 30,
      },
    ],
    recallAt10: 0.75,
    passed: 1,
    failed: 1,
    skipped: 0,
    latencyP50Ms: 12,
    latencyP95Ms: 30,
  }

  test('conserve les totaux et les requêtes en échec, avec audit', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    app.container.swap(
      SearchEvaluationService,
      () => ({ evaluate: async () => report }) as unknown as SearchEvaluationService
    )
    try {
      await post(client, admin, '/fr/admin/search/evaluate')
      const response = await client.get('/fr/admin/search').withInertia().loginAs(admin)

      const [run] = overviewOf(response).evaluationRuns
      assert.equal(run.status, 'completed')
      assert.equal(run.evaluation!.recallAt10, 0.75)
      assert.equal(run.evaluation!.passed, 1)
      assert.deepEqual(run.evaluation!.failures, [
        { id: 'q2', query: 'cadeau écolo', missing: ['c'], unexpected: ['b'] },
      ])
      assert.notProperty(run.evaluation, 'results')
      assert.lengthOf(await AdminAuditLog.query().where('action', 'search.evaluation_requested'), 1)
    } finally {
      app.container.restore(SearchEvaluationService)
    }
  })

  test('une évaluation qui échoue est conservée en échec', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    app.container.swap(
      SearchEvaluationService,
      () =>
        ({
          evaluate: async () => {
            throw new Error('Meilisearch unavailable: nothing to evaluate')
          },
        }) as unknown as SearchEvaluationService
    )
    try {
      await post(client, admin, '/fr/admin/search/evaluate')

      const run = await db.from('search_runs').first()
      assert.equal(run.status, 'failed')
      assert.match(run.error, /unavailable/)
    } finally {
      app.container.restore(SearchEvaluationService)
    }
  })
})
