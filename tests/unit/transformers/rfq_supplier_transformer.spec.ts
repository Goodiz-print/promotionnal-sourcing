import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import RfqSupplierTransformer from '#transformers/rfq_supplier_transformer'

async function recipient(overrides: { lateReplyAt?: DateTime | null; status?: 'expired' } = {}) {
  const organization = await OrganizationFactory.merge({
    id: 5,
    name: 'Textiles SA',
    slug: 'textiles-sa',
  }).make()
  const row = await RfqSupplierFactory.merge({
    id: 4,
    rfqId: 7,
    supplierOrganizationId: 5,
    status: overrides.status ?? 'responded',
    sentAt: DateTime.fromISO('2026-11-01T09:00:00.000Z', { zone: 'utc' }),
    lateReplyAt: overrides.lateReplyAt ?? null,
    replyToken: 'a'.repeat(32),
    agencyReplyToken: 'b'.repeat(32),
  }).make()
  row.$setRelated('supplierOrganization', organization)
  return row
}

test.group('RfqSupplierTransformer', () => {
  test('forme exacte du destinataire vu par l’agence, sans jeton relais', async ({ assert }) => {
    const output = new RfqSupplierTransformer(await recipient()).toObject()

    assert.deepEqual(output, {
      id: 4,
      supplierOrganizationId: 5,
      name: 'Textiles SA',
      slug: 'textiles-sa',
      logoUrl: output.logoUrl,
      status: 'responded',
      sentAt: '2026-11-01T09:00:00.000Z',
      lateReply: false,
    })
    assert.notInclude(JSON.stringify(output), 'a'.repeat(32))
    assert.notInclude(JSON.stringify(output), 'b'.repeat(32))
  })

  test('une réponse tardive est signalée, sans sa date (#232)', async ({ assert }) => {
    const output = new RfqSupplierTransformer(
      await recipient({ lateReplyAt: DateTime.fromISO('2026-11-10T08:00:00.000Z') })
    ).toObject()

    assert.isTrue(output.lateReply)
    assert.notProperty(output, 'lateReplyAt')
  })

  test('un destinataire expiré garde son statut, sans le statut d’avant', async ({ assert }) => {
    const row = await recipient({ status: 'expired' })
    row.expiredFrom = 'viewed'

    const output = new RfqSupplierTransformer(row).toObject()

    assert.equal(output.status, 'expired')
    assert.notProperty(output, 'expiredFrom')
  })
})
