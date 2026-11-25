import { test } from '@japa/runner'
import {
  isBuyerAnonymizedType,
  isLateReplyNotification,
  notificationMessageKey,
} from '#shared/helpers/notification'

/** Texte d'une notification avec ou sans nom d'agence (#220). */
test.group('notificationMessageKey', () => {
  test('une demande reçue sans agence prend le libellé anonyme', ({ assert }) => {
    assert.equal(
      notificationMessageKey('rfq.received', { rfqTitle: 'Tote bags' }),
      'notifications.anonymous.rfq.received'
    )
    assert.equal(
      notificationMessageKey('quote.rejected', { buyerName: null }),
      'notifications.anonymous.quote.rejected'
    )
  })

  test('avec le nom de l’agence, ou pour un autre type, le libellé habituel', ({ assert }) => {
    assert.equal(
      notificationMessageKey('rfq.received', { buyerName: 'Acme' }),
      'notifications.types.rfq.received'
    )
    assert.equal(
      notificationMessageKey('rfq.declined', { supplierName: 'Textiles SA' }),
      'notifications.types.rfq.declined'
    )
  })

  test('seuls les types adressés au fournisseur et nommant l’agence sont anonymisables', ({
    assert,
  }) => {
    assert.isTrue(isBuyerAnonymizedType('rfq.received'))
    assert.isTrue(isBuyerAnonymizedType('quote.rejected'))
    assert.isFalse(isBuyerAnonymizedType('quote.accepted'))
    assert.isFalse(isBuyerAnonymizedType('order.created'))
  })

  test('une réponse tardive prend le libellé « réponse tardive » (#232)', ({ assert }) => {
    assert.equal(
      notificationMessageKey('rfq.responded', { supplierName: 'Textiles SA', late: true }),
      'notifications.late.rfq.responded'
    )
    assert.equal(
      notificationMessageKey('rfq.responded', { supplierName: 'Textiles SA', late: false }),
      'notifications.types.rfq.responded'
    )
  })

  test('isLateReplyNotification : seule une réponse marquée tardive', ({ assert }) => {
    assert.isTrue(isLateReplyNotification('rfq.responded', { late: true }))
    assert.isFalse(isLateReplyNotification('rfq.responded', {}))
    assert.isFalse(isLateReplyNotification('rfq.declined', { late: true }))
  })
})
