import { test } from '@japa/runner'
import aiConfig from '#config/ai'
import { TranslationProviderError, TranslationRefusedError } from '#exceptions/ai_errors'
import TranslateEntityJob from '#jobs/translate_entity_job'
import type TranslationService from '#services/translation_service'

const PAYLOAD = {
  entity: 'product' as const,
  entityId: 12,
  sourceLocale: 'fr',
  targetLocales: ['en', 'de'],
}

/** Job hydraté comme par le worker, avec un faux `TranslationService`. */
function jobWith(translate: (input: typeof PAYLOAD) => Promise<unknown>) {
  const job = new TranslateEntityJob({ translate } as unknown as TranslationService)
  job.$hydrate(PAYLOAD, {
    jobId: 'job-test',
    name: 'TranslateEntityJob',
    attempt: 1,
    queue: 'default',
    priority: 5,
    acquiredAt: new Date(),
    stalledCount: 0,
  })
  return job
}

test.group('TranslateEntityJob', (group) => {
  const saved = {
    enabled: aiConfig.translation.enabled,
    provider: aiConfig.provider,
    mistralKey: aiConfig.mistral.apiKey,
    claudeKey: aiConfig.claude.apiKey,
  }

  group.each.setup(() => {
    aiConfig.translation.enabled = true
    aiConfig.provider = 'claude'
    aiConfig.mistral.apiKey = undefined
    aiConfig.claude.apiKey = 'sk-ant-test'
    return () => {
      aiConfig.translation.enabled = saved.enabled
      aiConfig.provider = saved.provider
      aiConfig.mistral.apiKey = saved.mistralKey
      aiConfig.claude.apiKey = saved.claudeKey
    }
  })

  test('traduit l’entité de la charge quand l’IA est activée et la clé présente', async ({
    assert,
  }) => {
    const calls: (typeof PAYLOAD)[] = []
    await jobWith(async (input) => calls.push(input)).execute()

    assert.deepEqual(calls, [PAYLOAD])
  })

  test('ne fait rien tant que la traduction est désactivée', async ({ assert }) => {
    aiConfig.translation.enabled = false
    let called = false
    await jobWith(async () => (called = true)).execute()

    assert.isFalse(called)
  })

  test('sans clé du fournisseur actif, ne fait rien et n’échoue pas', async ({ assert }) => {
    // La clé de l'autre fournisseur ne compte pas.
    aiConfig.claude.apiKey = undefined
    aiConfig.mistral.apiKey = 'mistral-key'
    let called = false
    await jobWith(async () => (called = true)).execute()

    assert.isFalse(called)
  })

  test('un refus du modèle n’est pas rejoué : le job se termine sans erreur', async ({
    assert,
  }) => {
    await assert.doesNotReject(() =>
      jobWith(async () => {
        throw new TranslationRefusedError()
      }).execute()
    )
  })

  test('une autre erreur du fournisseur remonte pour que la queue rejoue', async ({ assert }) => {
    await assert.rejects(
      () =>
        jobWith(async () => {
          throw new TranslationProviderError('invalid JSON')
        }).execute(),
      /invalid JSON/
    )
  })
})
