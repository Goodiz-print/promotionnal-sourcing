import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import RfqTransformer from '#transformers/rfq_transformer'

const BATCH_ID = '3f2b8c1e-4a5d-4e6f-9a7b-8c9d0e1f2a3b'

async function rfqOfBatch(batchId: string | null) {
  const rfq = await RfqFactory.merge({
    id: 7,
    batchId,
    status: 'published',
    buyerOrganizationId: 3,
    createdByUserId: 11,
    title: 'Tote bags',
    description: 'Sérigraphie',
    budgetMax: '5000.00',
    deadline: DateTime.fromISO('2026-10-30', { zone: 'Europe/Paris' }),
    publishedAt: DateTime.fromISO('2026-10-01T08:00:00.000Z', { zone: 'utc' }),
    closedAt: null,
    expiredAt: null,
    createdAt: DateTime.fromISO('2026-09-30T08:00:00.000Z', { zone: 'utc' }),
  }).make()
  const responded = await RfqSupplierFactory.merge({ id: 4, rfqId: 7, status: 'responded' }).make()
  const sent = await RfqSupplierFactory.merge({ id: 5, rfqId: 7, status: 'sent' }).make()
  rfq.$setRelated('items', [])
  rfq.$setRelated('suppliers', [responded, sent])
  return rfq
}

test.group('RfqTransformer', () => {
  test('forme exacte d’une ligne « mes demandes », lot de panier compris (#229)', async ({
    assert,
  }) => {
    const output = new RfqTransformer(await rfqOfBatch(BATCH_ID)).toObject()

    assert.deepEqual(output, {
      id: 7,
      batchId: BATCH_ID,
      title: 'Tote bags',
      status: 'published',
      budgetMax: '5000.00',
      deadline: '2026-10-30T00:00:00.000+01:00',
      itemCount: 0,
      supplierCount: 2,
      respondedCount: 1,
      publishedAt: '2026-10-01T08:00:00.000Z',
      closedAt: null,
      expiredAt: null,
      createdAt: '2026-09-30T08:00:00.000Z',
    })
    // Ni l'organisation acheteuse ni l'auteur ne fuient dans la ligne de liste.
    assert.notProperty(output, 'buyerOrganizationId')
    assert.notProperty(output, 'createdByUserId')
  })

  test('une demande créée hors panier n’a pas de lot', async ({ assert }) => {
    const output = new RfqTransformer(await rfqOfBatch(null)).toObject()

    assert.isNull(output.batchId)
  })
})
