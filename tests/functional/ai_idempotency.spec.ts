import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'
import Product from '#models/product'
import TranslationService from '#services/translation_service'
import MistralTranslationProvider from '#services/translation/mistral_translation_provider'
import aiConfig from '#config/ai'
import { useDatabase } from '#tests/utils/setup'
import { TRANSLATION_LOCALES } from '#shared/types/i18n'
import type TranslationProvider from '#services/translation/translation_provider'
import type { MistralChatClientLike } from '#shared/types/ai'
import {
  createSupplierProductValidator,
  updateSupplierProductValidator,
} from '#validators/supplier_product'

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

  test('une modification manuelle n’est plus écrasée par la traduction automatique', async ({
    assert,
  }) => {
    const { provider, requested } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')
    const target = {
      entity: 'product' as const,
      entityId: product.id,
      sourceLocale: 'fr',
      targetLocales: ['de', 'es'],
    }

    await service.translate(target)
    // Saisie fournisseur : la ligne repasse en manuel (cf. writeTranslations).
    await db
      .from('product_translations')
      .where('product_id', product.id)
      .where('locale', 'de')
      .update({ name: 'Stift saisi', is_auto: false, translation_key: null })
    const source = await sourceRow(product.id)
    await db.from('product_translations').where('id', source.id).update({ name: 'Crayon modifié' })

    await service.translate(target)

    assert.deepEqual(requested()[1], ['es'])
    const de = await db
      .from('product_translations')
      .where('product_id', product.id)
      .where('locale', 'de')
      .first()
    assert.equal(de.name, 'Stift saisi')
  })

  test('les lignes générées sont marquées is_auto', async ({ assert }) => {
    const { provider } = countingTranslator()
    const service = new TranslationService(provider)
    const product = await loadProduct('crayon-hb-bleu')

    await service.translate({
      entity: 'product',
      entityId: product.id,
      sourceLocale: 'fr',
      targetLocales: ['de'],
    })

    const de = await db
      .from('product_translations')
      .where('product_id', product.id)
      .where('locale', 'de')
      .first()
    assert.isTrue(de.is_auto)
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

  test('les 31 langues cibles partent dans un seul appel, avec un plafond de sortie', async ({
    assert,
  }) => {
    const targets = TRANSLATION_LOCALES.filter((locale) => locale !== 'fr')
    const answer = JSON.stringify(
      Object.fromEntries(targets.map((locale) => [locale, { name: `[${locale}]` }]))
    )
    let calls = 0
    let maxTokens = 0
    const provider = new MistralTranslationProvider({
      chat: {
        async complete(request) {
          calls++
          maxTokens = request.maxTokens
          return { choices: [{ message: { content: answer } }] }
        },
      },
    })

    const result = await provider.translate({ name: 'Crayon' }, 'fr', [...targets])

    assert.equal(targets.length, 31)
    assert.equal(calls, 1)
    assert.equal(maxTokens, aiConfig.translation.maxTokens)
    assert.deepEqual(Object.keys(result).sort(), [...targets].sort())
  })

  test('rejette une réponse tronquée par le plafond de sortie', async ({ assert }) => {
    const provider = new MistralTranslationProvider({
      chat: {
        async complete() {
          return { choices: [{ message: { content: '{"en":{"na' }, finishReason: 'length' }] }
        },
      },
    })

    await assert.rejects(() => provider.translate({ name: 'a' }, 'fr', ['en']), /truncated/)
  })
})

test.group('Validateur produit — langue source', () => {
  const base = {
    categoryId: 1,
    translations: { fr: { name: 'Crayon' } },
  }

  test('accepte une langue source et un contenu partiel', async ({ assert }) => {
    const data = await createSupplierProductValidator.validate({ ...base, sourceLocale: 'fr' })
    assert.equal(data.sourceLocale, 'fr')
  })

  test('accepte une langue source parmi les 32 langues de contenu', async ({ assert }) => {
    const data = await createSupplierProductValidator.validate({
      categoryId: 1,
      sourceLocale: 'bg',
      translations: { bg: { name: 'Молив' } },
    })
    assert.equal(data.sourceLocale, 'bg')
    assert.equal(data.translations.bg?.name, 'Молив')
  })

  test('refuse une langue source hors liste (ru est exclue)', async ({ assert }) => {
    await assert.rejects(() =>
      createSupplierProductValidator.validate({ ...base, sourceLocale: 'ru' })
    )
  })

  test('l’édition n’accepte pas de changement de langue source', async ({ assert }) => {
    const data = await updateSupplierProductValidator.validate({
      categoryId: 1,
      translations: { fr: { name: 'Crayon' } },
    })
    assert.deepEqual(Object.keys(data.translations ?? {}), ['fr'])
    assert.isUndefined((data as Record<string, unknown>).sourceLocale)
  })
})
