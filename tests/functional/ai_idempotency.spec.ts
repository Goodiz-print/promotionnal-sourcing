import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import EmbeddingService from '#services/embedding_service'
import TranslationService from '#services/translation_service'
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

/**
 * Faux traducteur : une entrée par appel, avec les locales demandées. Permet de
 * vérifier qu'un seul appel couvre toutes les locales à traduire.
 */
function countingTranslator(): {
  provider: TranslationProvider
  calls: () => number
  requested: () => string[][]
} {
  let calls = 0
  const requested: string[][] = []
  return {
    calls: () => calls,
    requested: () => requested,
    provider: {
      model: 'test-translate',
      async translate(fields, _source, targetLocales) {
        calls++
        requested.push([...targetLocales])
        return Object.fromEntries(
          targetLocales.map((locale) => [
            locale,
            Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, `[${locale}] ${v}`])),
          ])
        )
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

  test('toutes les locales passent dans un seul appel', async ({ assert }) => {
    const { provider, calls, requested } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')

    const outcome = await service.translate({
      entity: 'product',
      entityId: product.id,
      sourceLocale: 'fr',
      targetLocales: ['de', 'es', 'it'],
    })

    assert.equal(outcome, 'called')
    assert.equal(calls(), 1)
    assert.deepEqual(requested()[0], ['de', 'es', 'it'])

    const rows = await db
      .from('product_translations')
      .where('product_id', product.id)
      .whereIn('locale', ['de', 'es', 'it'])
    assert.lengthOf(rows, 3)
    assert.match(rows.find((row) => row.locale === 'de')!.name, /^\[de\] /)
  })

  test('relancer sans changement de source n’appelle pas le provider', async ({ assert }) => {
    const { provider, calls } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')
    const target = {
      entity: 'product' as const,
      entityId: product.id,
      sourceLocale: 'fr',
      targetLocales: ['de', 'es'],
    }

    assert.equal(await service.translate(target), 'called')
    assert.equal(await service.translate(target), 'skipped')
    assert.equal(calls(), 1)
  })

  test('modifier le texte source ne retraduit que les locales concernées, en un appel', async ({
    assert,
  }) => {
    const { provider, calls, requested } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')
    const target = {
      entity: 'product' as const,
      entityId: product.id,
      sourceLocale: 'fr',
      targetLocales: ['de', 'es'],
    }

    await service.translate(target)
    const source = await sourceRow(product.id)
    await db.from('product_translations').where('id', source.id).update({ name: 'Crayon modifié' })

    assert.equal(await service.translate(target), 'called')
    assert.equal(await service.translate(target), 'skipped')
    assert.equal(calls(), 2)
    assert.deepEqual(requested()[1], ['de', 'es'])

    const de = await db
      .from('product_translations')
      .where('product_id', product.id)
      .where('locale', 'de')
    assert.lengthOf(de, 1)
    assert.equal(de[0].name, '[de] Crayon modifié')
  })

  test('une traduction saisie à la main n’est jamais écrasée', async ({ assert }) => {
    const { provider, requested } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')
    const now = new Date()
    await db.table('product_translations').insert({
      product_id: product.id,
      locale: 'de',
      name: 'Crayon manuel',
      created_at: now,
      updated_at: now,
    })

    await service.translate({
      entity: 'product',
      entityId: product.id,
      sourceLocale: 'fr',
      targetLocales: ['de', 'es'],
    })

    assert.deepEqual(requested()[0], ['es'])
    const de = await db
      .from('product_translations')
      .where('product_id', product.id)
      .where('locale', 'de')
      .first()
    assert.equal(de.name, 'Crayon manuel')
    assert.isNull(de.translation_key)
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
          targetLocales: ['de'],
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
      targetLocales: ['de'],
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

  test('renvoie les champs traduits pour chaque locale', async ({ assert }) => {
    let model = ''
    const provider = new MistralTranslationProvider(
      client(
        '{"de":{"name":"Stift","description":"Blau"},"es":{"name":"Lápiz","description":"Azul"}}',
        (m) => (model = m)
      )
    )
    const result = await provider.translate({ name: 'Crayon', description: 'Bleu' }, 'fr', [
      'de',
      'es',
    ])

    assert.deepEqual(result, {
      de: { name: 'Stift', description: 'Blau' },
      es: { name: 'Lápiz', description: 'Azul' },
    })
    assert.equal(model, aiConfig.translation.model)
  })

  test('lève sur JSON invalide, locale ou champ manquant', async ({ assert }) => {
    await assert.rejects(
      () =>
        new MistralTranslationProvider(client('pas du json')).translate({ name: 'a' }, 'fr', [
          'en',
        ]),
      /invalid JSON/
    )
    await assert.rejects(
      () =>
        new MistralTranslationProvider(client('{"en":{"name":"a"}}')).translate(
          { name: 'a' },
          'fr',
          ['en', 'de']
        ),
      /missing locale "de"/
    )
    await assert.rejects(
      () =>
        new MistralTranslationProvider(client('{"en":{}}')).translate({ name: 'a' }, 'fr', ['en']),
      /missing field "name" for "en"/
    )
  })
})
