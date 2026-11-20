import { test } from '@japa/runner'
import { isBuyerAnonymizedType, notificationMessageKey } from '#shared/helpers/notification'

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
})
