import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import aiConfig from '#config/ai'
import { CategoryFactory } from '#database/factories/category_factory'
import { UserFactory } from '#database/factories/user_factory'
import AdminAuditLog from '#models/admin_audit_log'
import AiCallService from '#services/ai_call_service'
import TranslationBackfillService from '#services/translation_backfill_service'
import TranslationService from '#services/translation_service'
import type TranslationProvider from '#services/translation/translation_provider'
import { useDatabase } from '#tests/utils/setup'
import type { AdminAiOverview, AdminAiTranslationRow } from '#shared/types/admin_ai'
import type { TranslationBackfillOptions } from '#shared/types/ai'

/**
 * IA et traductions (#177) : journal des appels, tableau de bord, rattrapage et
 * relecture. `QUEUE_DRIVER=sync` en test : le rattrapage remplace donc
 * `TranslationBackfillService` par un faux, sans quoi les jobs de traduction
 * appelleraient Mistral.
 */
function call(overrides: Record<string, unknown> = {}) {
  return {
    service: 'translation',
    model: 'mistral-small-latest',
    entity: 'product',
    entity_id: 1,
    source_locale: 'fr',
    target_locales: JSON.stringify(['en']),
    prompt_tokens: 100,
    completion_tokens: 50,
    duration_ms: 300,
    status: 'success',
    error: null,
    created_at: new Date(),
    ...overrides,
  }
}

function post(client: any, user: unknown, url: string, body: object = {}, method = 'post') {
  return client[method](url)
    .json(body)
    .redirects(0)
    .withCsrfToken()
    .header('Accept', 'application/json')
    .loginAs(user)
}

test.group('IA — journal des appels', (group) => {
  useDatabase(group)

  test('TranslationService journalise chaque appel, y compris les échecs', async ({ assert }) => {
    const category = await CategoryFactory.create()
    await db.table('category_translations').insert({
      category_id: category.id,
      locale: 'fr',
      name: 'Stylos',
      created_at: new Date(),
    })

    let fail = false
    const provider: TranslationProvider = {
      model: 'test-translate',
      async translate(fields, _source, targets, usage) {
        if (usage) Object.assign(usage, { promptTokens: 120, completionTokens: 30 })
        if (fail) throw new Error('boom')
        return Object.fromEntries(
          targets.map((locale) => [locale, { name: `[${locale}] ${fields.name}` }])
        )
      },
    }
    const service = new TranslationService(provider, new AiCallService())
    const target = {
      entity: 'category' as const,
      entityId: category.id,
      sourceLocale: 'fr',
      targetLocales: ['en'],
    }

    await service.translate(target)
    // Même source, même clé d'idempotence : aucun appel, donc aucune ligne.
    await service.translate(target)
    fail = true
    await service.translate({ ...target, targetLocales: ['de'] }).catch(() => {})

    const rows = await db.from('ai_calls').orderBy('id')
    assert.lengthOf(rows, 2)
    assert.equal(rows[0].status, 'success')
    assert.equal(rows[0].prompt_tokens, 120)
    assert.equal(rows[0].completion_tokens, 30)
    assert.equal(rows[0].entity, 'category')
    assert.equal(rows[1].status, 'failed')
    assert.equal(rows[1].error, 'boom')
  })

  test('tronque le message d’erreur conservé', async ({ assert }) => {
    await new AiCallService().record({
      service: 'translation',
      model: 'mistral-small-latest',
      entity: null,
      entityId: null,
      sourceLocale: null,
      targetLocales: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      durationMs: 0,
      status: 'failed',
      error: 'x'.repeat(2000),
    })

    const row = await db.from('ai_calls').first()
    assert.lengthOf(row.error, 500)
  })
})

test.group('IA — rétention', (group) => {
  useDatabase(group)

  test('purge les appels au-delà de la rétention et garde les récents', async ({ assert }) => {
    await db
      .table('ai_calls')
      .multiInsert([call(), call({ created_at: new Date(Date.now() - 100 * 86_400_000) })])

    assert.equal(await new AiCallService().purge(), 1)
    assert.equal((await db.from('ai_calls').count('* as n').first())!.n, '1')
  })
})

test.group('IA — administration', (group) => {
  useDatabase(group)

  test('refuse l’accès sans le droit, y compris au support et au modérateur', async ({
    client,
  }) => {
    for (const state of ['platformModerator', 'platformSupport', 'platformAnalyst'] as const) {
      const user = await UserFactory.apply(state).create()
      const index = await client.get('/fr/admin/ai').withInertia().loginAs(user)
      const reviews = await client.get('/fr/admin/ai/translations').withInertia().loginAs(user)
      const backfill = await post(client, user, '/fr/admin/ai/backfill')
      const correct = await post(
        client,
        user,
        '/fr/admin/ai/translations/category/1/en',
        {},
        'patch'
      )
      for (const response of [index, reviews, backfill, correct]) response.assertStatus(403)
    }
  })

  test('le tableau de bord agrège appels, échecs, tokens et volume', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await db.table('ai_calls').multiInsert([
      call(),
      call({ status: 'failed', error: 'boom', prompt_tokens: 10, completion_tokens: 0 }),
      call({ status: 'truncated', error: 'response truncated' }),
      // Hors fenêtre de 30 jours : ignoré.
      call({ created_at: new Date(Date.now() - 40 * 86_400_000) }),
    ])

    const response = await client.get('/fr/admin/ai').withInertia().loginAs(admin)

    response.assertStatus(200)
    const overview = response.inertiaProps.overview as AdminAiOverview
    assert.equal(overview.totals.calls, 3)
    assert.equal(overview.totals.failed, 1)
    assert.equal(overview.totals.truncated, 1)
    assert.equal(overview.totals.promptTokens, 210)
    assert.equal(overview.totals.completionTokens, 100)
    assert.lengthOf(overview.daily, 30)
    assert.equal(
      overview.daily.reduce((sum, day) => sum + day.calls, 0),
      3
    )
    assert.lengthOf(overview.failures, 2)
    assert.equal(overview.failures[0].status, 'truncated')
  })

  test('estime le coût seulement quand un tarif est configuré', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await db.table('ai_calls').insert(
      call({
        model: aiConfig.translation.model,
        prompt_tokens: 1_000_000,
        completion_tokens: 500_000,
      })
    )
    const original = { ...aiConfig.pricing }

    try {
      const without = await client.get('/fr/admin/ai').withInertia().loginAs(admin)
      assert.isNull((without.inertiaProps.overview as AdminAiOverview).totals.estimatedCost)

      Object.assign(aiConfig.pricing, { inputPerMillion: 0.2, outputPerMillion: 0.6 })
      const priced = await client.get('/fr/admin/ai').withInertia().loginAs(admin)
      assert.closeTo(
        (priced.inertiaProps.overview as AdminAiOverview).totals.estimatedCost!,
        0.5,
        1e-9
      )
    } finally {
      Object.assign(aiConfig.pricing, original)
    }
  })

  test('ne chiffre que les appels du modèle actif, les tokens restent tous comptés', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    await db.table('ai_calls').insert([
      call({ model: aiConfig.translation.model, prompt_tokens: 1_000_000, completion_tokens: 0 }),
      // Appel d'avant un changement de fournisseur : son tarif n'est pas connu.
      call({ model: 'ancien-modele', prompt_tokens: 3_000_000, completion_tokens: 2_000_000 }),
    ])
    const original = { ...aiConfig.pricing }

    try {
      Object.assign(aiConfig.pricing, { inputPerMillion: 0.2, outputPerMillion: 0.6 })
      const response = await client.get('/fr/admin/ai').withInertia().loginAs(admin)
      const { totals } = response.inertiaProps.overview as AdminAiOverview

      assert.equal(totals.promptTokens, 4_000_000)
      assert.equal(totals.completionTokens, 2_000_000)
      assert.closeTo(totals.estimatedCost!, 0.2, 1e-9)
    } finally {
      Object.assign(aiConfig.pricing, original)
    }
  })

  test('refuse le rattrapage quand l’IA est désactivée', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    aiConfig.translation.enabled = false

    await post(client, admin, '/fr/admin/ai/backfill')

    assert.lengthOf(await AdminAuditLog.query().where('action', 'ai.backfill_requested'), 0)
  })

  test('lance le rattrapage, trace l’audit et impose un délai entre deux lancements', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const calls: TranslationBackfillOptions[] = []
    app.container.swap(
      TranslationBackfillService,
      () =>
        ({
          async backfill(options: TranslationBackfillOptions) {
            calls.push(options)
            return { queued: {}, failed: false }
          },
        }) as unknown as TranslationBackfillService
    )
    const enabled = aiConfig.translation.enabled
    aiConfig.translation.enabled = true

    try {
      await post(client, admin, '/fr/admin/ai/backfill', { entity: 'category' })
      await post(client, admin, '/fr/admin/ai/backfill')

      assert.deepEqual(calls, [{ entities: ['category'] }])
      const logs = await AdminAuditLog.query().where('action', 'ai.backfill_requested')
      assert.lengthOf(logs, 1)
      assert.equal(logs[0].actorUserId, admin.id)
    } finally {
      aiConfig.translation.enabled = enabled
      app.container.restore(TranslationBackfillService)
    }
  })
})

test.group('IA — relecture des traductions', (group) => {
  useDatabase(group)

  async function categoryWithTranslations() {
    const category = await CategoryFactory.create()
    const now = new Date()
    await db.table('category_translations').multiInsert([
      { category_id: category.id, locale: 'fr', name: 'Stylos', created_at: now },
      {
        category_id: category.id,
        locale: 'en',
        name: 'Penns',
        is_auto: true,
        translation_key: 'k',
        created_at: now,
      },
      { category_id: category.id, locale: 'de', name: 'Stifte', is_auto: false, created_at: now },
    ])
    return category
  }

  test('liste les traductions automatiques avec leur texte source, hors langue source', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const category = await categoryWithTranslations()

    const response = await client
      .get('/fr/admin/ai/translations?entity=category')
      .withInertia()
      .loginAs(admin)

    response.assertStatus(200)
    const rows = (response.inertiaProps.reviews as { data: AdminAiTranslationRow[] }).data
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].entityId, category.id)
    assert.equal(rows[0].locale, 'en')
    assert.isTrue(rows[0].isAuto)
    assert.deepEqual(rows[0].fields, [{ name: 'name', source: 'Stylos', value: 'Penns' }])

    const manual = await client
      .get('/fr/admin/ai/translations?entity=category&origin=manual')
      .withInertia()
      .loginAs(admin)
    assert.deepEqual(
      (manual.inertiaProps.reviews as { data: AdminAiTranslationRow[] }).data.map((r) => r.locale),
      ['de']
    )
  })

  test('une correction rend la traduction manuelle et est tracée', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const category = await categoryWithTranslations()

    await post(
      client,
      admin,
      `/fr/admin/ai/translations/category/${category.id}/en`,
      { name: 'Pens' },
      'patch'
    )

    const row = await db
      .from('category_translations')
      .where('category_id', category.id)
      .where('locale', 'en')
      .first()
    assert.equal(row.name, 'Pens')
    assert.isFalse(row.is_auto)

    const [log] = await AdminAuditLog.query().where('action', 'translation.corrected')
    assert.equal(log.targetType, 'translation')
    assert.equal(log.targetId, category.id)
    assert.deepEqual(log.changes?.before, { name: 'Penns' })
    assert.deepEqual(log.changes?.after, { name: 'Pens', entity: 'category', locale: 'en' })
  })

  test('refuse un nom vide, la langue source et une traduction inconnue', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const category = await categoryWithTranslations()
    const url = (locale: string) => `/fr/admin/ai/translations/category/${category.id}/${locale}`

    await post(client, admin, url('en'), { name: '' }, 'patch')
    const untouched = await db
      .from('category_translations')
      .where('category_id', category.id)
      .where('locale', 'en')
      .first()
    assert.equal(untouched.name, 'Penns')
    assert.isTrue(untouched.is_auto)

    const source = await post(client, admin, url('fr'), { name: 'X' }, 'patch')
    const unsupported = await post(client, admin, url('it'), { name: 'X' }, 'patch')
    const unknown = await post(client, admin, '/fr/admin/ai/translations/unknown/1/en', {}, 'patch')
    for (const response of [source, unsupported, unknown]) response.assertStatus(404)
    assert.lengthOf(await AdminAuditLog.query().where('action', 'translation.corrected'), 0)
  })
})
