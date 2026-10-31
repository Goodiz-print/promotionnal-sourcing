import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import { SearchEventFactory } from '#database/factories/search_event_factory'
import { UserFactory } from '#database/factories/user_factory'
import Category from '#models/category'
import SearchEvent from '#models/search_event'
import SearchEventService from '#services/search_event_service'
import {
  SEARCH_EVENT_PSEUDONYMIZE_AFTER_DAYS,
  SEARCH_EVENT_RETENTION_DAYS,
} from '#shared/types/search_event'
import { useDatabase } from '#tests/utils/setup'

test.group('Journal des recherches — enregistrement', (group) => {
  useDatabase(group, { seed: 'full' })

  test('une recherche du catalogue est enregistrée, moteur indisponible compris', async ({
    client,
    assert,
  }) => {
    await client.get('/fr/products').qs({ search: '  Stylo  BLEU ' })

    const events = await SearchEvent.all()
    assert.lengthOf(events, 1)
    assert.equal(events[0].source, 'catalogue')
    assert.equal(events[0].term, 'stylo bleu')
    assert.equal(events[0].locale, 'fr')
    assert.equal(events[0].resultsCount, 0)
    assert.equal(events[0].mode, 'unavailable')
    assert.isNull(events[0].userId)
  })

  test('un filtre sans terme est enregistré en mode directory avec ses filtres', async ({
    client,
    assert,
  }) => {
    const crayon = await Category.findByOrFail('slug', 'crayon')
    await client.get('/fr/products').qs({ categoryId: crayon.id, madeInEurope: 'true' })

    const [event] = await SearchEvent.all()
    assert.equal(event.mode, 'directory')
    assert.isNull(event.term)
    assert.equal(event.categoryId, crayon.id)
    assert.deepEqual(event.filters, { madeInEurope: true })
    assert.isAbove(event.resultsCount, 0)
  })

  test('la simple navigation et les pages suivantes ne sont pas enregistrées', async ({
    client,
    assert,
  }) => {
    await client.get('/fr/products')
    await client.get('/fr/products').qs({ search: 'stylo', page: 2 })
    await client.get('/fr/suppliers')

    assert.lengthOf(await SearchEvent.all(), 0)
  })

  test('une recherche de fournisseur est enregistrée', async ({ client, assert }) => {
    await client.get('/fr/suppliers').qs({ search: 'acme', country: 'FR' })

    const [event] = await SearchEvent.all()
    assert.equal(event.source, 'suppliers')
    assert.equal(event.term, 'acme')
    assert.deepEqual(event.filters, { country: 'FR' })
    assert.equal(event.mode, 'directory')
  })

  test('l’utilisateur connecté et son organisation sont rattachés à l’événement', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    await client.get('/fr/products').qs({ search: 'stylo' }).loginAs(user)

    const [event] = await SearchEvent.all()
    assert.equal(event.userId, user.id)
    assert.equal(event.organizationId, user.currentOrganizationId)
  })
})

test.group('Journal des recherches — rétention', (group) => {
  useDatabase(group, { seed: 'roles' })

  test('détache l’utilisateur après la durée de pseudonymisation, garde la requête', async ({
    assert,
  }) => {
    const user = await UserFactory.create()
    const old = await SearchEventFactory.merge({
      userId: user.id,
      organizationId: user.currentOrganizationId,
      createdAt: DateTime.now().minus({ days: SEARCH_EVENT_PSEUDONYMIZE_AFTER_DAYS + 1 }),
    }).create()
    const recent = await SearchEventFactory.merge({
      userId: user.id,
      createdAt: DateTime.now().minus({ days: 1 }),
    }).create()

    const service = await app.container.make(SearchEventService)
    const result = await service.purge()

    assert.equal(result.pseudonymized, 1)
    assert.equal(result.deleted, 0)
    await old.refresh()
    await recent.refresh()
    assert.isNull(old.userId)
    assert.isNull(old.organizationId)
    assert.isNotNull(old.term)
    assert.equal(recent.userId, user.id)
  })

  test('supprime les événements au-delà de la rétention, et reste idempotent', async ({
    assert,
  }) => {
    await SearchEventFactory.merge({
      createdAt: DateTime.now().minus({ days: SEARCH_EVENT_RETENTION_DAYS + 1 }),
    }).create()
    const kept = await SearchEventFactory.create()

    const service = await app.container.make(SearchEventService)
    const first = await service.purge()
    assert.equal(first.deleted, 1)
    assert.deepEqual(await service.purge(), { deleted: 0, pseudonymized: 0 })

    const remaining = await SearchEvent.all()
    assert.deepEqual(
      remaining.map((event) => event.id),
      [kept.id]
    )
  })
})
