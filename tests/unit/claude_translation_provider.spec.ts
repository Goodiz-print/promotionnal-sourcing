import { test } from '@japa/runner'
import aiConfig from '#config/ai'
import {
  TranslationProviderError,
  TranslationRefusedError,
  TranslationTruncatedError,
} from '#exceptions/ai_errors'
import ClaudeTranslationProvider from '#services/translation/claude_translation_provider'
import { translationSchema } from '#shared/helpers/llm'
import { TRANSLATION_LOCALES } from '#shared/types/i18n'
import { fakeClaudeClient } from '#tests/utils/fake_claude_client'

test.group('ClaudeTranslationProvider', () => {
  test('renvoie les champs traduits pour chaque locale et remplit les tokens', async ({
    assert,
  }) => {
    const { client } = fakeClaudeClient({
      text: '{"de":{"name":"Stift","description":"Blau"},"es":{"name":"Lápiz","description":"Azul"}}',
      leadingBlocks: [{ type: 'thinking' }],
      inputTokens: 120,
      outputTokens: 45,
    })
    const provider = new ClaudeTranslationProvider(client)
    const usage = { promptTokens: 0, completionTokens: 0 }

    const result = await provider.translate(
      { name: 'Crayon', description: 'Bleu' },
      'fr',
      ['de', 'es'],
      usage
    )

    assert.deepEqual(result, {
      de: { name: 'Stift', description: 'Blau' },
      es: { name: 'Lápiz', description: 'Azul' },
    })
    assert.deepEqual(usage, { promptTokens: 120, completionTokens: 45 })
    assert.equal(provider.model, aiConfig.translation.model)
  })

  test('envoie le modèle, le plafond, le texte source et un schéma de sortie strict', async ({
    assert,
  }) => {
    const { client, requests } = fakeClaudeClient({ text: '{"en":{"name":"Pencil"}}' })
    await new ClaudeTranslationProvider(client).translate({ name: 'Crayon' }, 'fr', ['en'])

    const [request] = requests
    assert.equal(request.model, aiConfig.translation.model)
    assert.equal(request.max_tokens, aiConfig.translation.maxTokens)
    assert.deepEqual(request.messages, [{ role: 'user', content: '{"name":"Crayon"}' }])
    assert.include(request.system as string, 'from "fr"')
    assert.deepEqual(request.output_config, {
      effort: 'low',
      format: { type: 'json_schema', schema: translationSchema(['name'], ['en']) },
    })
    // Paramètres refusés (400) par les modèles Claude récents.
    assert.notProperty(request, 'temperature')
    assert.notProperty(request, 'thinking')
  })

  test('lève sur réponse vide, JSON invalide, locale ou champ manquant', async ({ assert }) => {
    const translate = (text: string | undefined, locales: string[]) =>
      new ClaudeTranslationProvider(fakeClaudeClient({ text }).client).translate(
        { name: 'a' },
        'fr',
        locales
      )

    await assert.rejects(() => translate(undefined, ['en']), /empty response/)
    await assert.rejects(() => translate('pas du json', ['en']), /invalid JSON/)
    await assert.rejects(
      () => translate('{"en":{"name":"a"}}', ['en', 'de']),
      /missing locale "de"/
    )
    await assert.rejects(() => translate('{"en":{}}', ['en']), /missing field "name" for "en"/)
  })

  test('les 31 langues cibles partent dans un seul appel', async ({ assert }) => {
    const targets = TRANSLATION_LOCALES.filter((locale) => locale !== 'fr')
    const { client, requests } = fakeClaudeClient({
      text: JSON.stringify(
        Object.fromEntries(targets.map((locale) => [locale, { name: `[${locale}]` }]))
      ),
    })

    const result = await new ClaudeTranslationProvider(client).translate({ name: 'Crayon' }, 'fr', [
      ...targets,
    ])

    assert.equal(targets.length, 31)
    assert.lengthOf(requests, 1)
    assert.deepEqual(Object.keys(result).sort(), [...targets].sort())
  })

  test('rejette une réponse tronquée par le plafond de sortie, tokens comptés', async ({
    assert,
  }) => {
    const { client } = fakeClaudeClient({
      text: '{"en":{"na',
      stopReason: 'max_tokens',
      inputTokens: 10,
      outputTokens: 30_000,
    })
    const usage = { promptTokens: 0, completionTokens: 0 }

    await assert.rejects(
      () => new ClaudeTranslationProvider(client).translate({ name: 'a' }, 'fr', ['en'], usage),
      TranslationTruncatedError
    )
    assert.deepEqual(usage, { promptTokens: 10, completionTokens: 30_000 })
  })

  test('un refus du modèle est une erreur dédiée, non rejouable', async ({ assert }) => {
    const { client } = fakeClaudeClient({ stopReason: 'refusal' })
    const attempt = () =>
      new ClaudeTranslationProvider(client).translate({ name: 'a' }, 'fr', ['en'])

    await assert.rejects(attempt, TranslationRefusedError)
    await assert.rejects(attempt, /refusal/)
    assert.instanceOf(new TranslationRefusedError(), TranslationProviderError)
  })

  test('une erreur de l’API remonte telle quelle (clé absente ou refusée)', async ({ assert }) => {
    const { client } = fakeClaudeClient(new Error('Could not resolve authentication method'))
    await assert.rejects(
      () => new ClaudeTranslationProvider(client).translate({ name: 'a' }, 'fr', ['en']),
      /authentication method/
    )
  })
})
