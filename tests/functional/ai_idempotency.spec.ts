import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import EmbeddingService from '#services/embedding_service'
import TranslationService from '#services/translation_service'
import TranslationDispatcher from '#services/translation_dispatcher'
import TranslateEntityJob from '#jobs/translate_entity_job'
import MistralTranslationProvider from '#services/translation/mistral_translation_provider'
import aiConfig from '#config/ai'
import { useDatabase } from '#tests/utils/setup'
import type EmbeddingProvider from '#services/embeddings/embedding_provider'
import type TranslationProvider from '#services/translation/translation_provider'
import type { MistralChatClientLike } from '#shared/types/ai'

const DIMS = aiConfig.embeddings.dimensions

function countingEmbedder(): { provider: EmbeddingProvider; calls: () => number } {
  let calls = 0
  return {
    calls: () => calls,
    provider: {
      name: 'mistral',
      model: 'test-embed',
      async embed() {
        calls++
        return new Array<number>(DIMS).fill(0.1)
      },
    },
  }
}

function countingTranslator(): { provider: TranslationProvider; calls: () => number } {
  let calls = 0
  return {
    calls: () => calls,
    provider: {
      model: 'test-translate',
      async translate(fields, _source, target) {
        calls++
        return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, `[${target}] ${v}`]))
      },
    },
  }
}

async function loadProduct(slug: string): Promise<Product> {
  return Product.query().where('slug', slug).preload('translations').firstOrFail()
}

test.group('Idempotence — embeddings', (group) => {
  useDatabase(group, { seed: 'full' })

  test('relancer sans changement du texte source n’appelle pas le provider', async ({ assert }) => {
    const { provider, calls } = countingEmbedder()
    const service = new EmbeddingService(provider)
    const product = await loadProduct('crayon-hb-bleu')

    assert.isTrue(await service.embedAndStore(product))
    assert.isFalse(await service.embedAndStore(product))
    assert.equal(calls(), 1)

    const row = await db.from('products').where('id', product.id).first()
    assert.equal(row.embedding_key, service.embeddingKey(EmbeddingService.productText(product)))
  })

  test('modifier le texte source recalcule l’embedding', async ({ assert }) => {
    const { provider, calls } = countingEmbedder()
    const service = new EmbeddingService(provider)
    const product = await loadProduct('crayon-hb-bleu')

    await service.embedAndStore(product)
    product.translations[0].name = `${product.translations[0].name} v2`
    assert.isTrue(await service.embedAndStore(product))
    assert.equal(calls(), 2)
  })
})

test.group('Idempotence — traductions', (group) => {
  useDatabase(group, { seed: 'full' })

  async function sourceRow(productId: number) {
    return db
      .from('product_translations')
      .where('product_id', productId)
      .where('locale', 'fr')
      .first()
  }

  test('relancer sans changement de source n’appelle pas le provider', async ({ assert }) => {
    const { provider, calls } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')
    const target = {
      entity: 'product' as const,
      entityId: product.id,
      sourceLocale: 'fr',
      targetLocale: 'de',
    }

    assert.equal(await service.translate(target), 'called')
    assert.equal(await service.translate(target), 'skipped')
    assert.equal(calls(), 1)

    const rows = await db
      .from('product_translations')
      .where('product_id', product.id)
      .where('locale', 'de')
    assert.lengthOf(rows, 1)
    assert.match(rows[0].name, /^\[de\] /)
  })

  test('modifier le texte source retraduit exactement une fois par locale (upsert)', async ({
    assert,
  }) => {
    const { provider, calls } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')
    const base = { entity: 'product' as const, entityId: product.id, sourceLocale: 'fr' }

    await service.translate({ ...base, targetLocale: 'de' })
    await service.translate({ ...base, targetLocale: 'es' })
    const source = await sourceRow(product.id)
    await db.from('product_translations').where('id', source.id).update({ name: 'Crayon modifié' })

    assert.equal(await service.translate({ ...base, targetLocale: 'de' }), 'called')
    assert.equal(await service.translate({ ...base, targetLocale: 'de' }), 'skipped')
    assert.equal(await service.translate({ ...base, targetLocale: 'es' }), 'called')
    assert.equal(calls(), 4)

    const de = await db
      .from('product_translations')
      .where('product_id', product.id)
      .where('locale', 'de')
    assert.lengthOf(de, 1)
    assert.equal(de[0].name, '[de] Crayon modifié')
  })

  test('sans traduction source : lève, sans appel', async ({ assert }) => {
    const { provider, calls } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')

    await assert.rejects(
      () =>
        service.translate({
          entity: 'product',
          entityId: product.id,
          sourceLocale: 'xx',
          targetLocale: 'de',
        }),
      /source translation/
    )
    assert.equal(calls(), 0)
  })

  test('catégories : même mécanisme', async ({ assert }) => {
    const { provider, calls } = countingTranslator()
    const service = new TranslationService(provider)
    const category = await db.from('category_translations').where('locale', 'fr').firstOrFail()
    const target = {
      entity: 'category' as const,
      entityId: category.category_id,
      sourceLocale: 'fr',
      targetLocale: 'de',
    }

    await service.translate(target)
    await service.translate(target)
    assert.equal(calls(), 1)
  })
})

test.group('MistralTranslationProvider', () => {
  function client(content: unknown, onCall?: (model: string) => void): MistralChatClientLike {
    return {
      chat: {
        async complete(request) {
          onCall?.(request.model)
          return { choices: [{ message: { content } }] }
        },
      },
    }
  }

  test('renvoie les champs traduits', async ({ assert }) => {
    let model = ''
    const provider = new MistralTranslationProvider(
      client('{"name":"Pencil","description":"Blue"}', (m) => (model = m))
    )
    const result = await provider.translate({ name: 'Crayon', description: 'Bleu' }, 'fr', 'en')

    assert.deepEqual(result, { name: 'Pencil', description: 'Blue' })
    assert.equal(model, aiConfig.translation.model)
  })

  test('lève sur JSON invalide ou champ manquant', async ({ assert }) => {
    await assert.rejects(
      () =>
        new MistralTranslationProvider(client('pas du json')).translate({ name: 'a' }, 'fr', 'en'),
      /invalid JSON/
    )
    await assert.rejects(
      () => new MistralTranslationProvider(client('{}')).translate({ name: 'a' }, 'fr', 'en'),
      /missing field/
    )
  })
})

test.group('Politique de traduction — déclenchement (#75)', (group) => {
  useDatabase(group, { seed: 'full' })

  test('une traduction saisie à la main n’est jamais écrasée par le job', async ({ assert }) => {
    const { provider, calls } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')
    const target = {
      entity: 'product' as const,
      entityId: product.id,
      sourceLocale: 'fr',
      targetLocale: 'en',
    }
    const before = await db
      .from('product_translations')
      .where('product_id', product.id)
      .where('locale', 'en')
      .first()

    assert.isFalse(before.is_auto)
    assert.equal(await service.translate(target), 'skipped')
    assert.equal(calls(), 0)
  })

  test('une traduction générée est marquée « auto »', async ({ assert }) => {
    const { provider } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')
    await service.translate({
      entity: 'product',
      entityId: product.id,
      sourceLocale: 'fr',
      targetLocale: 'de',
    })

    const de = await db
      .from('product_translations')
      .where('product_id', product.id)
      .where('locale', 'de')
      .first()
    assert.isTrue(de.is_auto)
  })

  test('le dispatcher cible les autres langues de contenu que la source', async ({ assert }) => {
    const payloads: unknown[] = []
    const original = TranslateEntityJob.dispatch
    TranslateEntityJob.dispatch = (async (payload: unknown) => {
      payloads.push(payload)
    }) as unknown as typeof TranslateEntityJob.dispatch

    try {
      await new TranslationDispatcher().dispatch('category', 7, 'fr')
    } finally {
      TranslateEntityJob.dispatch = original
    }

    assert.deepEqual(payloads, [
      { entity: 'category', entityId: 7, sourceLocale: 'fr', targetLocales: ['en'] },
    ])
  })
})
