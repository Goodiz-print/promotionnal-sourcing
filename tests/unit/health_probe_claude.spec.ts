import { test } from '@japa/runner'
import Anthropic from '@anthropic-ai/sdk'
import aiConfig from '#config/ai'
import healthConfig from '#config/health'
import HealthProbeService from '#services/health_probe_service'
import type HealthService from '#services/health_service'
import type SearchEngine from '#services/search/search_engine'
import type StorageService from '#services/storage/storage_service'
import { fakeClaudeClient } from '#tests/utils/fake_claude_client'

/**
 * Sonde `claude` seule, sans base : les autres dépendances du service sont des
 * coquilles vides (leurs sondes échouent, chacune isolée) et `fetch` est coupé.
 */
async function claudeStatus(modelsError?: Error) {
  const service = new HealthProbeService(
    {} as HealthService,
    {} as SearchEngine,
    {} as StorageService,
    fakeClaudeClient({}, { modelsError }).client
  )
  const report = await service.report()
  return report.components.find(({ component }) => component === 'claude')!.status
}

const apiError = (status: number) =>
  Anthropic.APIError.generate(status, undefined, `HTTP ${status}`, new Headers())

test.group('HealthProbeService — sonde Claude', (group) => {
  const saved = { provider: aiConfig.provider, key: aiConfig.claude.apiKey }
  const savedTimeout = healthConfig.probeTimeoutMs
  const realFetch = globalThis.fetch

  group.each.setup(() => {
    aiConfig.provider = 'claude'
    aiConfig.claude.apiKey = 'sk-ant-test'
    healthConfig.probeTimeoutMs = 500
    globalThis.fetch = (async () => {
      throw new Error('network disabled in tests')
    }) as typeof fetch
    return () => {
      aiConfig.provider = saved.provider
      aiConfig.claude.apiKey = saved.key
      healthConfig.probeTimeoutMs = savedTimeout
      globalThis.fetch = realFetch
    }
  })

  test('ok quand l’API répond', async ({ assert }) => {
    assert.equal(await claudeStatus(), 'ok')
  })

  test('clé refusée (401, 403) : en panne', async ({ assert }) => {
    assert.equal(await claudeStatus(apiError(401)), 'down')
    assert.equal(await claudeStatus(apiError(403)), 'down')
  })

  test('erreur HTTP autre ou API injoignable : dégradé seulement', async ({ assert }) => {
    assert.equal(await claudeStatus(apiError(529)), 'degraded')
    assert.equal(await claudeStatus(new Anthropic.APIConnectionError({})), 'degraded')
  })

  test('non sondé sans clé', async ({ assert }) => {
    aiConfig.claude.apiKey = undefined
    assert.equal(await claudeStatus(apiError(401)), 'disabled')
  })
})
