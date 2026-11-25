import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import { RfqNotFoundException } from '#exceptions/rfq_errors'
import SupplierRfqTransformer from '#transformers/supplier_rfq_transformer'
import type RfqSupplier from '#models/rfq_supplier'

async function rfqFor(recipients: RfqSupplier[]) {
  const buyer = await OrganizationFactory.merge({ id: 3, name: 'Acme' }).make()
  const rfq = await RfqFactory.merge({
    id: 7,
    status: 'expired',
    buyerOrganizationId: 3,
    title: 'Tote bags',
    budgetMax: '5000.00',
    deadline: DateTime.fromISO('2026-10-30', { zone: 'Europe/Paris' }),
    publishedAt: DateTime.fromISO('2026-10-01T08:00:00.000Z', { zone: 'utc' }),
  }).make()
  rfq.$setRelated('buyerOrganization', buyer)
  rfq.$setRelated('items', [])
  rfq.$setRelated('suppliers', recipients)
  return rfq
}

async function expiredRecipient(lateReplyAt: DateTime | null) {
  return RfqSupplierFactory.merge({
    id: 4,
    rfqId: 7,
    supplierOrganizationId: 5,
    status: 'expired',
    expiredFrom: 'viewed',
    lateReplyAt,
    sentAt: DateTime.fromISO('2026-10-02T08:00:00.000Z', { zone: 'utc' }),
  }).make()
}

test.group('SupplierRfqTransformer', () => {
  test('forme exacte vue du fournisseur : statut expiré, ni budget ni agence (#232)', async ({
    assert,
  }) => {
    const output = new SupplierRfqTransformer(
      await rfqFor([await expiredRecipient(null)])
    ).toObject()

    assert.deepEqual(output, {
      id: 7,
      title: 'Tote bags',
      status: 'expired',
      deadline: '2026-10-30T00:00:00.000+01:00',
      itemCount: 0,
      buyerName: null,
      buyerLogoUrl: null,
      myStatus: 'expired',
      myState: 'expired',
      myLateReply: false,
      sentAt: '2026-10-02T08:00:00.000Z',
      publishedAt: '2026-10-01T08:00:00.000Z',
    })
    assert.notInclude(JSON.stringify(output), '5000')
    assert.notInclude(JSON.stringify(output), 'Acme')
  })

  test('sa réponse tardive est signalée ; l’agence nommée pour un abonné', async ({ assert }) => {
    const recipient = await expiredRecipient(DateTime.fromISO('2026-11-02T08:00:00.000Z'))
    const output = new SupplierRfqTransformer(await rfqFor([recipient]), true).toObject()

    assert.isTrue(output.myLateReply)
    assert.equal(output.buyerName, 'Acme')
    assert.notProperty(output, 'lateReplyAt')
  })

  test('statut lisible (#230) et lignes comptées en sous-requête par la liste', async ({
    assert,
  }) => {
    const recipient = await expiredRecipient(null)
    recipient.status = 'viewed'
    const rfq = await rfqFor([recipient])
    // `RfqService#listForSupplier` compte les items sans les charger.
    rfq.$extras.itemsCount = '3'

    const output = new SupplierRfqTransformer(rfq).toObject()

    assert.equal(output.myStatus, 'viewed')
    assert.equal(output.myState, 'to_process')
    assert.strictEqual(output.itemCount, 3)
  })

  test('sans la ligne du fournisseur courant, un 404 plutôt qu’une demande anonyme', async ({
    assert,
  }) => {
    const transformer = new SupplierRfqTransformer(await rfqFor([]))

    assert.throws(() => transformer.toObject(), RfqNotFoundException)
  })
})
