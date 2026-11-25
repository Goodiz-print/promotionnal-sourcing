import { test } from '@japa/runner'
import {
  acceptsQuoteUpload,
  rfqAcceptsQuoteUpload,
  supplierRfqFiltersForPage,
  supplierRfqListQuery,
  supplierRfqState,
} from '#shared/helpers/supplier_rfq'
import { RFQ_STATUSES, RFQ_SUPPLIER_STATUSES, SUPPLIER_RFQ_STATE_STATUSES } from '#shared/types/rfq'

test.group('supplierRfqState (#230)', () => {
  test('une demande envoyée ou lue, sans réponse, est « à traiter »', ({ assert }) => {
    assert.equal(supplierRfqState('sent'), 'to_process')
    assert.equal(supplierRfqState('viewed'), 'to_process')
  })

  test('répondu, expiré et décliné gardent leur sens', ({ assert }) => {
    assert.equal(supplierRfqState('responded'), 'responded')
    assert.equal(supplierRfqState('expired'), 'expired')
    assert.equal(supplierRfqState('declined'), 'declined')
  })

  test('une ligne `pending`, jamais montrée, retombe sur « à traiter »', ({ assert }) => {
    assert.equal(supplierRfqState('pending'), 'to_process')
  })

  test('chaque statut reçu appartient à un seul statut lisible', ({ assert }) => {
    const mapped = Object.values(SUPPLIER_RFQ_STATE_STATUSES).flat()
    assert.sameMembers(
      mapped,
      RFQ_SUPPLIER_STATUSES.filter((status) => status !== 'pending')
    )
    assert.equal(new Set(mapped).size, mapped.length)
  })
})

test.group('Filtres de « Demandes reçues » (#230)', () => {
  test('la query string ne porte que le filtre posé', ({ assert }) => {
    assert.deepEqual(supplierRfqListQuery({ status: 'expired' }), { status: 'expired' })
    assert.deepEqual(supplierRfqListQuery({ status: null }), {})
  })

  test('un filtre absent vaut `null` pour la page', ({ assert }) => {
    assert.deepEqual(supplierRfqFiltersForPage({}), { status: null })
    assert.deepEqual(supplierRfqFiltersForPage({ status: 'responded' }), { status: 'responded' })
  })
})

test.group('acceptsQuoteUpload (#230)', () => {
  test('refuse une demande non envoyée ou déclinée, accepte les autres statuts', ({ assert }) => {
    const accepted = RFQ_SUPPLIER_STATUSES.filter((status) => acceptsQuoteUpload(status))
    assert.deepEqual(accepted, ['sent', 'viewed', 'responded', 'expired'])
  })
})

test.group('rfqAcceptsQuoteUpload (#290)', () => {
  test('refuse une demande clôturée ou en brouillon, accepte publiée et expirée (réponse tardive)', ({
    assert,
  }) => {
    const accepted = RFQ_STATUSES.filter((status) => rfqAcceptsQuoteUpload(status))
    assert.deepEqual(accepted, ['published', 'expired'])
  })
})
