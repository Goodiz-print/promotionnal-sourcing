import { test } from '@japa/runner'
import {
  claudeImageMediaType,
  claudeText,
  estimateLlmCost,
  imageQuerySchema,
  llmApiKey,
  pickTranslations,
  resolveLlmProvider,
  translationSchema,
  translationShapeError,
  tryParseJson,
} from '#shared/helpers/llm'

test.group('llmApiKey', () => {
  const keys = { mistral: { apiKey: 'mistral-key' }, claude: { apiKey: 'claude-key' } }

  test('rend la clé du fournisseur actif', ({ assert }) => {
    assert.equal(llmApiKey({ provider: 'mistral', ...keys }), 'mistral-key')
    assert.equal(llmApiKey({ provider: 'claude', ...keys }), 'claude-key')
  })

  test('la clé de l’autre fournisseur ne compte pas ; une clé vide vaut absente', ({ assert }) => {
    assert.isUndefined(llmApiKey({ provider: 'claude', mistral: { apiKey: 'k' }, claude: {} }))
    assert.isUndefined(
      llmApiKey({ provider: 'mistral', mistral: { apiKey: '' }, claude: { apiKey: 'k' } })
    )
  })
})

test.group('tryParseJson', () => {
  test('parse du JSON, rend undefined sinon', ({ assert }) => {
    assert.deepEqual(tryParseJson('{"a":1}'), { a: 1 })
    assert.isNull(tryParseJson('null'))
    assert.isUndefined(tryParseJson('pas du json'))
    assert.isUndefined(tryParseJson('{"a":'))
  })
})

test.group('schémas de sortie structurée', () => {
  test('translationSchema exige chaque locale et chaque champ, rien d’autre', ({ assert }) => {
    const localized = {
      type: 'object',
      properties: { name: { type: 'string' }, description: { type: 'string' } },
      required: ['name', 'description'],
      additionalProperties: false,
    }
    assert.deepEqual(translationSchema(['name', 'description'], ['en', 'de']), {
      type: 'object',
      properties: { en: localized, de: localized },
      required: ['en', 'de'],
      additionalProperties: false,
    })
  })

  test('imageQuerySchema exige une requête textuelle', ({ assert }) => {
    assert.deepEqual(imageQuerySchema(), {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false,
    })
  })
})

test.group('translationShapeError / pickTranslations', () => {
  test('null quand chaque locale porte chaque champ', ({ assert }) => {
    const parsed = { en: { name: 'Pen' }, de: { name: 'Stift' } }
    assert.isNull(translationShapeError(parsed, ['name'], ['en', 'de']))
  })

  test('signale une locale absente ou qui n’est pas un objet', ({ assert }) => {
    assert.equal(
      translationShapeError({ en: { name: 'a' } }, ['name'], ['en', 'de']),
      'missing locale "de"'
    )
    assert.equal(translationShapeError({ en: 'Pen' }, ['name'], ['en']), 'missing locale "en"')
    assert.equal(translationShapeError({ en: ['Pen'] }, ['name'], ['en']), 'missing locale "en"')
    assert.equal(translationShapeError(null, ['name'], ['en']), 'missing locale "en"')
    assert.equal(translationShapeError('texte', ['name'], ['en']), 'missing locale "en"')
  })

  test('signale un champ absent ou non textuel', ({ assert }) => {
    assert.equal(
      translationShapeError({ en: {} }, ['name'], ['en']),
      'missing field "name" for "en"'
    )
    assert.equal(
      translationShapeError({ en: { name: 'a' }, de: { name: 3 } }, ['name'], ['en', 'de']),
      'missing field "name" for "de"'
    )
  })

  test('pickTranslations ne garde que les locales et champs demandés', ({ assert }) => {
    const parsed = { en: { name: 'Pen', extra: 'x' }, de: { name: 'Stift' }, it: { name: 'Penna' } }
    assert.deepEqual(pickTranslations(parsed, ['name'], ['en', 'de']), {
      en: { name: 'Pen' },
      de: { name: 'Stift' },
    })
  })
})

test.group('claudeText / claudeImageMediaType', () => {
  test('assemble les blocs texte et ignore les autres (réflexion)', ({ assert }) => {
    const blocks = [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: '{"query":' },
      { type: 'text', text: '"gourde"}' },
    ]
    assert.equal(claudeText(blocks), '{"query":"gourde"}')
    assert.equal(claudeText([{ type: 'thinking' }]), '')
    assert.equal(claudeText([]), '')
  })

  test('n’accepte que les formats d’image de l’API Claude', ({ assert }) => {
    assert.equal(claudeImageMediaType('image/jpeg'), 'image/jpeg')
    assert.equal(claudeImageMediaType('image/webp'), 'image/webp')
    assert.isNull(claudeImageMediaType('image/tiff'))
    assert.isNull(claudeImageMediaType('application/pdf'))
  })
})

test.group('estimateLlmCost', () => {
  const usage = { promptTokens: 1_000_000, completionTokens: 500_000 }

  test('applique le tarif par million de tokens', ({ assert }) => {
    assert.closeTo(
      estimateLlmCost(usage, { inputPerMillion: 0.2, outputPerMillion: 0.6 })!,
      0.5,
      1e-9
    )
    assert.equal(
      estimateLlmCost(
        { promptTokens: 0, completionTokens: 0 },
        { inputPerMillion: 1, outputPerMillion: 5 }
      ),
      0
    )
  })

  test('rend null tant qu’un des deux tarifs manque', ({ assert }) => {
    assert.isNull(estimateLlmCost(usage, {}))
    assert.isNull(estimateLlmCost(usage, { inputPerMillion: 0.2 }))
    assert.isNull(estimateLlmCost(usage, { outputPerMillion: 0.6 }))
  })

  test('un tarif à zéro est un tarif, pas une absence', ({ assert }) => {
    assert.equal(estimateLlmCost(usage, { inputPerMillion: 0, outputPerMillion: 0 }), 0)
  })
})

test.group('resolveLlmProvider', () => {
  test('Claude passe en premier dès que sa clé est présente', ({ assert }) => {
    assert.equal(resolveLlmProvider({ claude: 'sk-ant', mistral: 'mistral-key' }), 'claude')
    assert.equal(resolveLlmProvider({ claude: 'sk-ant', mistral: undefined }), 'claude')
  })

  test('Mistral quand seule sa clé est présente (clé vide = absente)', ({ assert }) => {
    assert.equal(resolveLlmProvider({ claude: undefined, mistral: 'mistral-key' }), 'mistral')
    assert.equal(resolveLlmProvider({ claude: '', mistral: 'mistral-key' }), 'mistral')
  })

  test('sans aucune clé : Claude, et aucune clé active (IA indisponible)', ({ assert }) => {
    const provider = resolveLlmProvider({ claude: undefined, mistral: undefined })
    assert.equal(provider, 'claude')
    assert.isUndefined(llmApiKey({ provider, claude: {}, mistral: {} }))
  })
})
