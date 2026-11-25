import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import { NotificationFactory } from '#database/factories/notification_factory'
import NotificationTransformer, { notificationHref } from '#transformers/notification_transformer'

const CREATED_AT = DateTime.fromISO('2026-11-22T10:00:00.000Z', { zone: 'utc' })

test.group('NotificationTransformer', (group) => {
  // Le lien est résolu par le routeur : ses routes ne sont chargées qu'avec le
  // serveur HTTP, que la suite unitaire ne démarre pas d'elle-même.
  group.setup(() => testUtils.httpServer().start())

  test('forme exacte : type, données, dates et lien dans la langue donnée', async ({ assert }) => {
    const notification = await NotificationFactory.merge({
      id: 3,
      userId: 42,
      type: 'rfq.relay_refused',
      data: {
        inboundMailId: 8,
        rfqId: 7,
        rfqTitle: 'Tote bags',
        supplierName: 'Fournisseur Dupuis',
        senderAddress: 'assistante@gmail.test',
      },
      createdAt: CREATED_AT,
    }).make()

    const item = new NotificationTransformer(notification, 'en').toObject()

    assert.deepEqual(item, {
      id: 3,
      type: 'rfq.relay_refused',
      data: {
        inboundMailId: 8,
        rfqId: 7,
        rfqTitle: 'Tote bags',
        supplierName: 'Fournisseur Dupuis',
        senderAddress: 'assistante@gmail.test',
      },
      readAt: null,
      createdAt: '2026-11-22T10:00:00.000Z',
      href: '/en/rfqs/7',
    })
    assert.notProperty(item, 'userId')
  })

  test('une notification lue porte sa date de lecture', async ({ assert }) => {
    const notification = await NotificationFactory.apply('read')
      .merge({ id: 4, type: 'announcement', createdAt: CREATED_AT })
      .make()

    assert.isString(new NotificationTransformer(notification).toObject().readAt)
  })

  test('notificationHref : un mail de l’agence non relayé mène à la demande (#226)', ({
    assert,
  }) => {
    assert.equal(notificationHref('rfq.relay_refused', { rfqId: 7 }, 'fr'), '/fr/rfqs/7')
    assert.equal(notificationHref('rfq.responded', { rfqId: 7 }, 'fr'), '/fr/rfqs/7')
  })

  test('notificationHref : sans contexte, retombe sur la liste des notifications', ({ assert }) => {
    const fallback = notificationHref('rfq.relay_refused', {}, 'fr')

    assert.notInclude(fallback, 'rfqs')
    assert.include(fallback, '/fr/')
  })
})
