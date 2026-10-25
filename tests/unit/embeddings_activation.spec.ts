import { test } from '@japa/runner'
import aiConfig from '#config/ai'
import {
  resolveEmbeddingsEnabled,
  type EmbeddingsActivationInput,
} from '#shared/helpers/embeddings_activation'

const BASE: EmbeddingsActivationInput = {
  provider: 'mistral',
  requested: undefined,
  configured: true,
  nodeEnv: 'production',
}

test.group('Vectorisation — activation', () => {
  test('active par défaut dès que le provider est configuré', ({ assert }) => {
    assert.isTrue(resolveEmbeddingsEnabled(BASE))
    assert.isTrue(resolveEmbeddingsEnabled({ ...BASE, nodeEnv: 'development' }))
  })

  test('sans identifiants, elle reste coupée sans erreur (dev local, CI)', ({ assert }) => {
    assert.isFalse(resolveEmbeddingsEnabled({ ...BASE, configured: false }))
    assert.isFalse(resolveEmbeddingsEnabled({ ...BASE, configured: false, nodeEnv: 'development' }))
  })

  test('en test, coupée par défaut même avec une clé : la suite n’appelle jamais un réseau', ({
    assert,
  }) => {
    assert.isFalse(resolveEmbeddingsEnabled({ ...BASE, nodeEnv: 'test' }))
  })

  test('AI_EMBEDDINGS_ENABLED=false la coupe explicitement, même avec une clé', ({ assert }) => {
    assert.isFalse(resolveEmbeddingsEnabled({ ...BASE, requested: false }))
  })

  test('AI_EMBEDDINGS_ENABLED=true l’active, y compris en test', ({ assert }) => {
    assert.isTrue(resolveEmbeddingsEnabled({ ...BASE, requested: true, nodeEnv: 'test' }))
  })

  test('AI_EMBEDDINGS_ENABLED=true sans identifiants est une erreur de configuration', ({
    assert,
  }) => {
    assert.throws(
      () => resolveEmbeddingsEnabled({ ...BASE, requested: true, configured: false }),
      /MISTRAL_API_KEY manquant/
    )
    assert.throws(
      () =>
        resolveEmbeddingsEnabled({
          ...BASE,
          provider: 'openai-compatible',
          requested: true,
          configured: false,
        }),
      /AI_API_KEY ou AI_BASE_URL manquant/
    )
  })

  test('la suite de tests tourne avec la vectorisation coupée', ({ assert }) => {
    assert.isFalse(aiConfig.embeddings.enabled)
  })
})
