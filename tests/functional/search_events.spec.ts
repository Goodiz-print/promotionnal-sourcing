import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import searchConfig from '#config/search'
import RecordSearchEventJob from '#jobs/record_search_event_job'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { UserFactory } from '#database/factories/user_factory'
import Product from '#models/product'
import SearchEvent from '#models/search_event'
import SearchEventStore from '#services/search_event_store'
import { createMember } from '#tests/utils/organizations'
import { installFakeEngine, type FakeEngineHandle } from '#tests/utils/fake_search_engine'
import { useDatabase } from '#tests/utils/setup'
import type { SearchEventPayload } from '#shared/types/search_event'

async function firstMode(): Promise<string> {
  const event = await SearchEvent.firstOrFail()
  return event.mode
}

async function ids(...slugs: string[]): Promise<number[]> {
  const products = await Product.query().whereIn('slug', slugs)
  return slugs.map((slug) => products.find((product) => product.slug === slug)!.id)
}

function payload(overrides: Partial<SearchEventPayload> = {}): SearchEventPayload {
  return {
    source: 'catalogue',
    query: 'crayon',
    filters: {},
    categoryId: null,
    mode: 'keyword',
    resultsCount: 3,
    userId: null,
    organizationId: null,
    locale: 'fr',
    ...overrides,
  }
}

test.group('Journal des recherches — catalogue', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  const previous = { enabled: searchConfig.embedder.enabled }
  group.each.setup(() => {
    handle = installFakeEngine()
    return () => {
      handle.restore()
      searchConfig.embedder.enabled = previous.enabled
    }
  })

  test('une recherche enregistre le terme normalisé, le mode et le nombre de résultats', async ({
    client,
    assert,
  }) => {
    searchConfig.embedder.enabled = false
    handle.engine.hits = { ids: await ids('crayon-hb-bleu', 'crayon-hb-rouge'), total: 2 }
    const org = await OrganizationFactory.create()
    const buyer = await createMember(org, 'owner')

    await client.get('/fr/products').qs({ search: '  Crayon   BLEU ' }).withInertia().loginAs(buyer)

    const events = await SearchEvent.all()
    assert.lengthOf(events, 1)
    const [event] = events
    assert.equal(event.source, 'catalogue')
    assert.equal(event.query, 'crayon bleu')
    assert.equal(event.mode, 'keyword')
    assert.equal(event.resultsCount, 2)
    assert.isFalse(event.zeroResults)
    assert.equal(event.userId, buyer.id)
    assert.equal(event.organizationId, org.id)
    assert.equal(event.locale, 'fr')
  })

  test('une recherche sémantique est tracée comme telle', async ({ client, assert }) => {
    searchConfig.embedder.enabled = true
    handle.engine.hits = { ids: await ids('crayon-hb-bleu'), total: 1 }

    await client.get('/fr/products').qs({ search: 'crayon' }).withInertia()

    assert.equal(await firstMode(), 'semantic')
  })

  test('le repli en mots-clés quand l’API d’embeddings échoue est tracé comme keyword', async ({
    client,
    assert,
  }) => {
    searchConfig.embedder.enabled = true
    handle.engine.failSemantic = true
    handle.engine.hits = { ids: await ids('crayon-hb-bleu'), total: 1 }

    await client.get('/fr/products').qs({ search: 'crayon' }).withInertia()

    assert.equal(await firstMode(), 'keyword')
  })

  test('une recherche sans résultat est marquée zero_results', async ({ client, assert }) => {
    handle.engine.hits = { ids: [], total: 0 }

    await client.get('/fr/products').qs({ search: 'introuvable' }).withInertia()

    const event = await SearchEvent.firstOrFail()
    assert.equal(event.resultsCount, 0)
    assert.isTrue(event.zeroResults)
    assert.isNull(event.userId)
  })

  test('moteur indisponible : la page répond et la recherche est tracée unavailable', async ({
    client,
    assert,
  }) => {
    handle.engine.hits = new Error('down')

    const response = await client.get('/fr/products').qs({ search: 'crayon' }).withInertia()

    response.assertStatus(200)
    assert.isTrue(response.inertiaProps.searchUnavailable)
    assert.equal(await firstMode(), 'unavailable')
  })

  test('la navigation par filtres est tracée en browse, avec ses filtres', async ({
    client,
    assert,
  }) => {
    await client.get('/fr/products').qs({ madeInEurope: 'true' }).withInertia()

    const event = await SearchEvent.firstOrFail()
    assert.isNull(event.query)
    assert.equal(event.mode, 'browse')
    assert.deepEqual(event.filters, { madeInEurope: true })
  })

  test('la page 2 et la simple ouverture du catalogue ne créent aucun événement', async ({
    client,
    assert,
  }) => {
    handle.engine.hits = { ids: await ids('crayon-hb-bleu'), total: 1 }

    await client.get('/fr/products').withInertia()
    await client.get('/fr/products').qs({ search: 'crayon', page: 2 }).withInertia()
    await client.get('/fr/products').qs({ sort: 'price_asc' }).withInertia()

    assert.lengthOf(await SearchEvent.all(), 0)
  })

  test('une file indisponible ne fait pas échouer la recherche', async ({ client, assert }) => {
    handle.engine.hits = { ids: await ids('crayon-hb-bleu'), total: 1 }
    const original = RecordSearchEventJob.dispatch
    RecordSearchEventJob.dispatch = (() => {
      throw new Error('queue down')
    }) as unknown as typeof RecordSearchEventJob.dispatch

    try {
      const response = await client.get('/fr/products').qs({ search: 'crayon' }).withInertia()
      response.assertStatus(200)
    } finally {
      RecordSearchEventJob.dispatch = original
    }
    assert.lengthOf(await SearchEvent.all(), 0)
  })
})

test.group('Journal des recherches — annuaire fournisseurs', (group) => {
  useDatabase(group, { seed: 'full' })

  test('la recherche par nom et le filtre pays sont tracés', async ({ client, assert }) => {
    await client.get('/fr/suppliers').qs({ search: 'Atelier', country: 'FR' }).withInertia()

    const event = await SearchEvent.firstOrFail()
    assert.equal(event.source, 'suppliers')
    assert.equal(event.query, 'atelier')
    assert.equal(event.mode, 'keyword')
    assert.deepEqual(event.filters, { country: 'FR' })
  })

  test('le filtre pays seul est tracé en browse ; la liste nue ne l’est pas', async ({
    client,
    assert,
  }) => {
    await client.get('/fr/suppliers').withInertia()
    assert.lengthOf(await SearchEvent.all(), 0)

    await client.get('/fr/suppliers').qs({ country: 'FR' }).withInertia()
    assert.equal(await firstMode(), 'browse')
  })
})

test.group('Journal des recherches — sélecteur de produit RFQ', (group) => {
  useDatabase(group, { seed: 'full' })

  let handle: FakeEngineHandle
  group.each.setup(() => {
    handle = installFakeEngine()
    return () => handle.restore()
  })

  async function lookup(term: string, client: ApiClient) {
    const org = await OrganizationFactory.create()
    const owner = await createMember(org, 'owner')
    await client
      .get(`/fr/rfqs/new?productSearch=${term}`)
      .withInertia()
      .header('X-Inertia-Partial-Component', 'rfqs/create')
      .header('X-Inertia-Partial-Data', 'productResults,productSearchUnavailable')
      .loginAs(owner)
    return org
  }

  test('le lookup est tracé une seule fois, avec son nombre de résultats', async ({
    client,
    assert,
  }) => {
    handle.engine.hits = { ids: await ids('crayon-hb-bleu', 'crayon-hb-rouge'), total: 2 }

    const org = await lookup('crayon', client)

    const events = await SearchEvent.all()
    assert.lengthOf(events, 1)
    assert.equal(events[0].source, 'rfq_lookup')
    assert.equal(events[0].resultsCount, 2)
    assert.equal(events[0].organizationId, org.id)
  })

  test('l’ouverture du formulaire sans partial reload ne trace rien', async ({
    client,
    assert,
  }) => {
    const org = await OrganizationFactory.create()
    const owner = await createMember(org, 'owner')

    await client.get('/fr/rfqs/new?productSearch=crayon').withInertia().loginAs(owner)

    assert.lengthOf(await SearchEvent.all(), 0)
  })

  test('moteur indisponible : tracé en unavailable', async ({ client, assert }) => {
    handle.engine.hits = new Error('down')

    await lookup('crayon', client)

    assert.equal(await firstMode(), 'unavailable')
  })
})

test.group('Journal des recherches — déduplication et RGPD', (group) => {
  useDatabase(group)

  async function service() {
    return app.container.make(SearchEventStore)
  }

  test('la même recherche du même utilisateur dans la fenêtre n’est écrite qu’une fois', async ({
    assert,
  }) => {
    const user = await UserFactory.create()
    const events = await service()

    assert.isTrue(await events.persist(payload({ userId: user.id })))
    assert.isFalse(await events.persist(payload({ userId: user.id })))
    assert.isTrue(await events.persist(payload({ userId: user.id, query: 'stylo' })))
    assert.isTrue(await events.persist(payload({ userId: user.id, filters: { ecoOnly: true } })))
    assert.lengthOf(await SearchEvent.all(), 3)
  })

  test('hors de la fenêtre, la même recherche est de nouveau écrite', async ({ assert }) => {
    const user = await UserFactory.create()
    const events = await service()
    await events.persist(payload({ userId: user.id }))
    await db
      .from('search_events')
      .update({ created_at: DateTime.now().minus({ minutes: 5 }).toJSDate() })

    assert.isTrue(await events.persist(payload({ userId: user.id })))
  })

  test('un visiteur anonyme n’est pas dédoublonné', async ({ assert }) => {
    const events = await service()

    assert.isTrue(await events.persist(payload()))
    assert.isTrue(await events.persist(payload()))
  })

  test('la purge détache l’utilisateur après 90 jours puis supprime après 24 mois', async ({
    assert,
  }) => {
    const user = await UserFactory.create()
    const events = await service()
    const insert = (query: string, days: number) =>
      db.table('search_events').insert({
        source: 'catalogue',
        query,
        filters: '{}',
        mode: 'keyword',
        results_count: 1,
        zero_results: false,
        user_id: user.id,
        locale: 'fr',
        created_at: DateTime.now().minus({ days }).toJSDate(),
      })
    await insert('recent', 10)
    await insert('ancien', 120)
    await insert('perime', 800)

    const report = await events.purge()

    assert.deepEqual(report, { pseudonymised: 2, deleted: 1 })
    const remaining = await SearchEvent.query().orderBy('query')
    assert.deepEqual(
      remaining.map((event) => [event.query, event.userId]),
      [
        ['ancien', null],
        ['recent', user.id],
      ]
    )
  })
})
