import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import aiConfig from '#config/ai'
import searchConfig from '#config/search'
import AttributeValue from '#models/attribute_value'
import Category from '#models/category'
import Product from '#models/product'
import { UserFactory } from '#database/factories/user_factory'
import ModerationService from '#services/moderation_service'
import ProductSearchService from '#services/product_search_service'
import EmbeddingProvider from '#services/embeddings/embedding_provider'
import QueryVectorCache from '#services/search/query_vector_cache'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'

/**
 * Recherche des produits par le moteur (#112) : mots-clés + vecteur de la
 * requête, puis rechargement depuis PostgreSQL. Le moteur est un double qui
 * répond ce qu'on lui dit : on vérifie ce que l'application lui demande et ce
 * qu'elle fait de la réponse.
 */
const OPTIONS = {
  search: 'crayon',
  categoryId: null,
  madeInEurope: false,
  attributeValueIds: [],
  page: 1,
  perPage: 12,
}

async function ids(...slugs: string[]): Promise<number[]> {
  const products = await Product.query().whereIn('slug', slugs)
  return slugs.map((slug) => products.find((product) => product.slug === slug)!.id)
}

test.group('Recherche — rechargement depuis PostgreSQL', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine()
    return () => handle.restore()
  })

  async function service() {
    return app.container.make(ProductSearchService)
  }

  test('les produits sont rendus dans l’ordre du moteur, avec son total', async ({ assert }) => {
    handle.engine.hits = {
      ids: await ids('crayon-hb-rouge', 'crayon-hb-bleu', 'crayon-aquarelle-bleu'),
      total: 3,
    }

    const search = await service()
    const page = await search.search(OPTIONS)

    assert.deepEqual(
      page!.all().map((product) => product.slug),
      ['crayon-hb-rouge', 'crayon-hb-bleu', 'crayon-aquarelle-bleu']
    )
    assert.equal(page!.total, 3)
    assert.equal(page!.currentPage, 1)
    assert.isAbove(page!.all()[0].translations.length, 0)
  })

  test('la requête transmet mots-clés, filtres, page et ratio au moteur', async ({ assert }) => {
    const crayon = await Category.findByOrFail('slug', 'crayon')
    const blue = await AttributeValue.findByOrFail('slug', 'blue')
    handle.engine.hits = { ids: [], total: 0 }

    const search = await service()
    await search.search({
      ...OPTIONS,
      search: '  crayon  ',
      categoryId: crayon.id,
      madeInEurope: true,
      attributeValueIds: [blue.id],
      page: 2,
      perPage: 5,
    })

    assert.lengthOf(handle.engine.requests, 1)
    assert.deepEqual(handle.engine.requests[0], {
      query: 'crayon',
      vector: null,
      semanticRatio: searchConfig.semanticRatio,
      filter: { categoryId: crayon.id, madeInEurope: true, attributeValueIds: [blue.id] },
      page: 2,
      perPage: 5,
    })
  })

  test('un produit devenu invisible depuis la dernière synchronisation est écarté', async ({
    assert,
  }) => {
    const reviewer = await UserFactory.apply('platformAdmin').create()
    const [rejected, visible] = await ids('crayon-hb-rouge', 'crayon-hb-bleu')
    const moderation = await app.container.make(ModerationService)
    await moderation.decide({
      targetType: 'product',
      targetId: rejected,
      status: 'rejected',
      decidedBy: reviewer,
    })
    handle.engine.hits = { ids: [rejected, visible], total: 2 }

    const search = await service()
    const page = await search.search(OPTIONS)

    assert.deepEqual(
      page!.all().map((product) => product.id),
      [visible]
    )
  })

  test('la base revérifie les facettes demandées sur les produits retournés', async ({
    assert,
  }) => {
    const blue = await AttributeValue.findByOrFail('slug', 'blue')
    // Le moteur se trompe (index en retard) : il renvoie un crayon rouge.
    handle.engine.hits = {
      ids: await ids('crayon-hb-rouge', 'crayon-hb-bleu'),
      total: 2,
    }

    const search = await service()
    const page = await search.search({ ...OPTIONS, attributeValueIds: [blue.id] })

    assert.deepEqual(
      page!.all().map((product) => product.slug),
      ['crayon-hb-bleu']
    )
  })

  test('sans terme, ou moteur inerte, la recherche n’est pas disponible (repli)', async ({
    assert,
  }) => {
    const search = await service()

    assert.isNull(await search.search({ ...OPTIONS, search: null }))
    assert.isNull(await search.search({ ...OPTIONS, search: '   ' }))
    assert.lengthOf(handle.engine.requests, 0)

    handle.engine.enabled = false
    assert.isNull(await search.search(OPTIONS))
    assert.isNull(await search.lookup('crayon', 8))
    assert.lengthOf(handle.engine.requests, 0)
  })

  test('un moteur injoignable donne le repli, pas une erreur', async ({ assert }) => {
    handle.engine.hits = new Error('connect ECONNREFUSED')
    const search = await service()

    assert.isNull(await search.search(OPTIONS))
    assert.isNull(await search.lookup('crayon', 8))
  })

  test('le sélecteur de demande cherche par mots-clés seuls et charge le fournisseur', async ({
    assert,
  }) => {
    handle.engine.hits = { ids: await ids('stylo-bille-bleu'), total: 1 }

    const search = await service()
    const products = await search.lookup('stylo', 8)

    assert.lengthOf(products!, 1)
    assert.equal(products![0].slug, 'stylo-bille-bleu')
    assert.isDefined(products![0].supplier.organization)
    assert.deepInclude(handle.engine.requests[0], {
      query: 'stylo',
      vector: null,
      semanticRatio: 0,
      perPage: 8,
    })
  })
})

test.group('Recherche — vecteur de la requête', (group) => {
  useDatabase(group, { seed: 'full' })

  const calls: string[] = []
  let failing = false
  let handle: FakeEngineHandle
  const previous = { enabled: aiConfig.embeddings.enabled }

  group.each.setup(() => {
    calls.length = 0
    failing = false
    handle = installFakeEngine()
    aiConfig.embeddings.enabled = true
    app.container.swap(EmbeddingProvider, () => ({
      name: 'mistral' as const,
      model: 'test-embed',
      async embed(text: string) {
        calls.push(text)
        if (failing) throw new Error('provider down')
        return new Array<number>(aiConfig.embeddings.dimensions).fill(0.25)
      },
    }))
    return async () => {
      handle.restore()
      aiConfig.embeddings.enabled = previous.enabled
      app.container.restore(EmbeddingProvider)
      const cache = await app.container.make(QueryVectorCache)
      cache.clear()
    }
  })

  async function service() {
    const cache = await app.container.make(QueryVectorCache)
    cache.clear()
    return app.container.make(ProductSearchService)
  }

  test('le vecteur calculé accompagne les mots-clés', async ({ assert }) => {
    const search = await service()

    await search.search(OPTIONS)

    assert.deepEqual(calls, ['crayon'])
    assert.lengthOf(handle.engine.requests[0].vector!, aiConfig.embeddings.dimensions)
  })

  test('la même requête ne paie pas deux fois le provider', async ({ assert }) => {
    const search = await service()

    await search.search(OPTIONS)
    await search.search({ ...OPTIONS, page: 2 })
    await search.search({ ...OPTIONS, search: 'CRAYON ' })

    assert.lengthOf(calls, 1)
    assert.lengthOf(handle.engine.requests, 3)
    assert.isNotNull(handle.engine.requests[2].vector)
  })

  test('un provider en panne laisse la recherche par mots-clés seuls', async ({ assert }) => {
    failing = true
    handle.engine.hits = { ids: await ids('crayon-hb-bleu'), total: 1 }
    const search = await service()

    const page = await search.search(OPTIONS)

    assert.isNull(handle.engine.requests[0].vector)
    assert.lengthOf(page!.all(), 1)
  })

  test('le sélecteur de demande n’appelle jamais le provider', async ({ assert }) => {
    const search = await service()

    await search.lookup('crayon', 8)

    assert.lengthOf(calls, 0)
  })
})

test.group('Recherche — écrans', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine()
    return () => handle.restore()
  })

  test('le catalogue public affiche les résultats du moteur', async ({ client, assert }) => {
    handle.engine.hits = {
      ids: await ids('sac-coton-bleu', 'crayon-hb-bleu'),
      total: 2,
    }

    const response = await client.get('/fr/products').qs({ search: 'cadeau' }).withInertia()

    response.assertStatus(200)
    assert.deepEqual(
      response.inertiaProps.products.data.map((product: { slug: string }) => product.slug),
      ['sac-coton-bleu', 'crayon-hb-bleu']
    )
    assert.equal(response.inertiaProps.products.meta.total, 2)
  })

  test('sans terme, le catalogue reste servi par PostgreSQL', async ({ client, assert }) => {
    const response = await client.get('/fr/products').withInertia()

    assert.lengthOf(response.inertiaProps.products.data, 6)
    assert.lengthOf(handle.engine.requests, 0)
  })

  test('moteur injoignable : la recherche retombe sur PostgreSQL', async ({ client, assert }) => {
    handle.engine.hits = new Error('connect ECONNREFUSED')

    const response = await client.get('/fr/products').qs({ search: 'aquarelle' }).withInertia()

    response.assertStatus(200)
    assert.lengthOf(response.inertiaProps.products.data, 1)
    assert.equal(response.inertiaProps.products.data[0].slug, 'crayon-aquarelle-bleu')
  })
})
