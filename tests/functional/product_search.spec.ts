import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import searchConfig from '#config/search'
import AttributeValue from '#models/attribute_value'
import Category from '#models/category'
import Product from '#models/product'
import { UserFactory } from '#database/factories/user_factory'
import ModerationService from '#services/moderation_service'
import ProductSearchService from '#services/product_search_service'
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
      // Embedder coupé en test : mots-clés seuls.
      semanticRatio: 0,
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
      semanticRatio: 0,
      perPage: 8,
    })
  })
})

test.group('Recherche — sémantique (embedder de Meilisearch)', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  const previous = { enabled: searchConfig.embedder.enabled, ratio: searchConfig.semanticRatio }

  group.each.setup(() => {
    handle = installFakeEngine()
    return () => {
      handle.restore()
      searchConfig.embedder.enabled = previous.enabled
      searchConfig.semanticRatio = previous.ratio
    }
  })

  async function service() {
    return app.container.make(ProductSearchService)
  }

  test('embedder actif : la requête demande le ratio sémantique configuré', async ({ assert }) => {
    searchConfig.embedder.enabled = true
    searchConfig.semanticRatio = 0.7
    const search = await service()

    await search.search(OPTIONS)

    assert.equal(handle.engine.requests[0].semanticRatio, 0.7)
  })

  test('embedder coupé : mots-clés seuls, quel que soit le ratio configuré', async ({ assert }) => {
    searchConfig.embedder.enabled = false
    searchConfig.semanticRatio = 0.7
    const search = await service()

    await search.search(OPTIONS)

    assert.equal(handle.engine.requests[0].semanticRatio, 0)
  })

  test('une API d’embeddings en panne rejoue la requête par mots-clés seuls', async ({
    assert,
  }) => {
    searchConfig.embedder.enabled = true
    handle.engine.failSemantic = true
    handle.engine.hits = { ids: await ids('crayon-hb-bleu'), total: 1 }
    const search = await service()

    const page = await search.search(OPTIONS)

    assert.deepEqual(
      handle.engine.requests.map((request) => request.semanticRatio),
      [searchConfig.semanticRatio, 0]
    )
    assert.lengthOf(page!.all(), 1)
  })

  test('le sélecteur de demande reste par mots-clés seuls, embedder actif', async ({ assert }) => {
    searchConfig.embedder.enabled = true
    const search = await service()

    await search.lookup('crayon', 8)

    assert.equal(handle.engine.requests[0].semanticRatio, 0)
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
