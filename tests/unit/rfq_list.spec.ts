import { test } from '@japa/runner'
import {
  groupRfqsByBatch,
  hasActiveRfqFilters,
  rfqFiltersForPage,
  rfqListQuery,
  rfqProgress,
} from '#shared/helpers/rfq_list'

const BATCH = '3f2b8c1e-4a5d-4e6f-9a7b-8c9d0e1f2a3b'
const OTHER_BATCH = '9a7b8c9d-0e1f-4a5d-8c1e-3f2b4e6f2a3b'

test.group('rfqProgress (#228)', () => {
  test('une demande publiée mais envoyée à personne reste « publiée »', ({ assert }) => {
    assert.equal(rfqProgress({ status: 'published', sentCount: 0, respondedCount: 0 }), 'published')
  })

  test('une demande publiée est « envoyée » tant que personne n’a répondu', ({ assert }) => {
    assert.equal(rfqProgress({ status: 'published', sentCount: 2, respondedCount: 0 }), 'sent')
  })

  test('une demande publiée devient « répondue » dès la première réponse', ({ assert }) => {
    assert.equal(rfqProgress({ status: 'published', sentCount: 2, respondedCount: 1 }), 'responded')
  })

  test('les autres statuts sont repris tels quels', ({ assert }) => {
    assert.equal(rfqProgress({ status: 'draft', sentCount: 0, respondedCount: 0 }), 'draft')
    assert.equal(rfqProgress({ status: 'closed', sentCount: 3, respondedCount: 3 }), 'closed')
    assert.equal(rfqProgress({ status: 'expired', sentCount: 2, respondedCount: 1 }), 'expired')
  })
})

test.group('groupRfqsByBatch (#228)', () => {
  test('regroupe un lot de panier, chaque demande hors lot reste seule', ({ assert }) => {
    const groups = groupRfqsByBatch([
      { id: 5, batchId: BATCH },
      { id: 4, batchId: null },
      { id: 3, batchId: BATCH },
      { id: 2, batchId: OTHER_BATCH },
      { id: 1, batchId: null },
    ])

    assert.deepEqual(
      groups.map(({ key, batchId, rfqs }) => ({ key, batchId, ids: rfqs.map(({ id }) => id) })),
      [
        { key: BATCH, batchId: BATCH, ids: [5, 3] },
        { key: 'rfq-4', batchId: null, ids: [4] },
        { key: OTHER_BATCH, batchId: OTHER_BATCH, ids: [2] },
        { key: 'rfq-1', batchId: null, ids: [1] },
      ]
    )
  })

  test('une liste vide ne donne aucun groupe', ({ assert }) => {
    assert.deepEqual(groupRfqsByBatch([]), [])
  })
})

test.group('Filtres de « Mes demandes » (#228)', () => {
  test('la query string ne garde que les filtres posés', ({ assert }) => {
    assert.deepEqual(rfqListQuery({ status: 'responded', authorId: 12 }), {
      status: 'responded',
      authorId: '12',
    })
    assert.deepEqual(rfqListQuery({ status: null, authorId: 12 }), { authorId: '12' })
    assert.deepEqual(rfqListQuery({ status: null, authorId: null }), {})
  })

  test('un filtre posé suffit à rendre la liste filtrée', ({ assert }) => {
    assert.isFalse(hasActiveRfqFilters({ status: null, authorId: null }))
    assert.isTrue(hasActiveRfqFilters({ status: 'draft', authorId: null }))
    assert.isTrue(hasActiveRfqFilters({ status: null, authorId: 3 }))
  })

  test('les filtres absents arrivent à la page en null', ({ assert }) => {
    assert.deepEqual(rfqFiltersForPage({}), { status: null, authorId: null })
    assert.deepEqual(rfqFiltersForPage({ status: 'sent', authorId: 4 }), {
      status: 'sent',
      authorId: 4,
    })
  })
})
