import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import { ActivityEventFactory } from '#database/factories/activity_event_factory'
import { UserFactory } from '#database/factories/user_factory'
import ActivityEvent from '#models/activity_event'
import Product from '#models/product'
import Supplier from '#models/supplier'
import ActivityEventService from '#services/activity_event_service'
import {
  ACTIVITY_EVENT_PSEUDONYMIZE_AFTER_DAYS,
  ACTIVITY_EVENT_RETENTION_DAYS,
} from '#shared/types/activity_event'
import { useDatabase } from '#tests/utils/setup'

test.group('Consultations — enregistrement', (group) => {
  useDatabase(group, { seed: 'full' })

  test('la fiche produit enregistre une vue', async ({ client, assert }) => {
    const product = await Product.query().where('isActive', true).firstOrFail()
    await client.get(`/fr/products/${product.slug}`)

    const [event] = await ActivityEvent.all()
    assert.equal(event.type, 'product_viewed')
    assert.equal(event.targetType, 'product')
    assert.equal(event.targetId, product.id)
    assert.isNull(event.userId)
  })

  test('la fiche fournisseur enregistre une vue', async ({ client, assert }) => {
    const supplier = await Supplier.query().where('isActive', true).firstOrFail()
    await client.get(`/fr/suppliers/${supplier.slug}`)

    const [event] = await ActivityEvent.all()
    assert.equal(event.type, 'supplier_viewed')
    assert.equal(event.targetId, supplier.id)
  })

  test('une vue répétée par le même utilisateur connecté n’est comptée qu’une fois', async ({
    client,
    assert,
  }) => {
    const user = await UserFactory.create()
    const product = await Product.query().where('isActive', true).firstOrFail()

    await client.get(`/fr/products/${product.slug}`).loginAs(user)
    await client.get(`/fr/products/${product.slug}`).loginAs(user)

    const events = await ActivityEvent.all()
    assert.lengthOf(events, 1)
    assert.equal(events[0].userId, user.id)
  })

  test('une consultation par un rôle plateforme n’est pas comptée', async ({ client, assert }) => {
    const admin = await UserFactory.apply('platformAdmin').create()
    const product = await Product.query().where('isActive', true).firstOrFail()

    await client.get(`/fr/products/${product.slug}`).loginAs(admin)

    assert.lengthOf(await ActivityEvent.all(), 0)
  })

  test('un fournisseur qui consulte sa propre fiche n’est pas compté', async ({ assert }) => {
    const supplier = await Supplier.query().where('isActive', true).firstOrFail()
    const service = await app.container.make(ActivityEventService)

    const stored = await service.store({
      type: 'supplier_viewed',
      targetType: 'supplier',
      targetId: supplier.id,
      userId: null,
      organizationId: supplier.organizationId,
      occurredAt: DateTime.now().toISO()!,
    })

    assert.isNull(stored)
    assert.lengthOf(await ActivityEvent.all(), 0)
  })

  test('les étapes du funnel RFQ ne sont jamais dédoublonnées', async ({ assert }) => {
    const user = await UserFactory.create()
    const service = await app.container.make(ActivityEventService)
    const payload = {
      type: 'rfq_product_added' as const,
      targetType: 'product' as const,
      targetId: 1,
      userId: user.id,
      organizationId: null,
      occurredAt: DateTime.now().toISO()!,
    }

    await service.store(payload)
    await service.store(payload)

    assert.lengthOf(await ActivityEvent.all(), 2)
  })
})

test.group('Consultations — rétention', (group) => {
  useDatabase(group, { seed: 'roles' })

  test('pseudonymise puis supprime selon 90 jours puis 24 mois', async ({ assert }) => {
    const user = await UserFactory.create()
    const old = await ActivityEventFactory.merge({
      userId: user.id,
      createdAt: DateTime.now().minus({ days: ACTIVITY_EVENT_PSEUDONYMIZE_AFTER_DAYS + 1 }),
    }).create()
    await ActivityEventFactory.merge({
      createdAt: DateTime.now().minus({ days: ACTIVITY_EVENT_RETENTION_DAYS + 1 }),
    }).create()

    const service = await app.container.make(ActivityEventService)
    const result = await service.purge()

    assert.deepEqual(result, { pseudonymized: 1, deleted: 1 })
    await old.refresh()
    assert.isNull(old.userId)
  })
})
