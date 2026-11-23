import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { RfqFactory } from '#database/factories/rfq_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import { UserFactory } from '#database/factories/user_factory'
import RfqListItemTransformer from '#transformers/rfq_list_item_transformer'

interface RowOptions {
  status?: 'draft' | 'published' | 'closed' | 'expired'
  respondedCount?: number
  sentCount?: number
  pendingCount?: number
  receivedQuotesCount?: number | string
  quoteDocumentsCount?: number | string
  withAuthor?: boolean
}

async function row({
  status = 'published',
  respondedCount = 0,
  sentCount = 0,
  pendingCount = 0,
  receivedQuotesCount = 0,
  quoteDocumentsCount = 0,
  withAuthor = true,
}: RowOptions = {}) {
  const rfq = await RfqFactory.merge({
    id: 7,
    batchId: null,
    status,
    buyerOrganizationId: 3,
    createdByUserId: 11,
    title: 'Tote bags',
    budgetMax: null,
    deadline: null,
    publishedAt: null,
    closedAt: null,
    expiredAt: null,
    createdAt: DateTime.fromISO('2026-09-30T08:00:00.000Z', { zone: 'utc' }),
  }).make()
  const suppliers = [
    ...(await RfqSupplierFactory.merge({ rfqId: 7, status: 'responded' }).makeMany(respondedCount)),
    ...(await RfqSupplierFactory.merge({ rfqId: 7, status: 'sent' }).makeMany(sentCount)),
    ...(await RfqSupplierFactory.merge({ rfqId: 7, status: 'pending' }).makeMany(pendingCount)),
  ]
  const author = await UserFactory.merge({
    id: 11,
    firstName: 'Camille',
    lastName: 'Martin',
    email: 'camille@agence.test',
    password: 'secret-hash',
  }).make()
  rfq.$setRelated('items', [])
  rfq.$setRelated('suppliers', suppliers)
  // Comptés en sous-requête par `RfqService#listForBuyer` (PostgreSQL les rend en chaîne).
  rfq.$extras = { receivedQuotesCount, quoteDocumentsCount }
  if (withAuthor) rfq.$setRelated('createdBy', author)
  return rfq
}

test.group('RfqListItemTransformer (#228)', () => {
  test('ajoute l’auteur, l’avancement et l’indicateur « devis reçu »', async ({ assert }) => {
    const output = new RfqListItemTransformer(await row({ respondedCount: 1 })).toObject()

    assert.equal(output.createdByName, 'Camille Martin')
    assert.equal(output.progress, 'responded')
    assert.isFalse(output.hasReceivedQuote)
    // Ni l'auteur (id, email, hash) ni l'organisation ne fuient.
    assert.notProperty(output, 'createdBy')
    assert.notProperty(output, 'createdByUserId')
    assert.notProperty(output, 'buyerOrganizationId')
    assert.notInclude(JSON.stringify(output), 'camille@agence.test')
    assert.notInclude(JSON.stringify(output), 'secret-hash')
  })

  test('un devis structuré remis compte comme devis reçu', async ({ assert }) => {
    const output = new RfqListItemTransformer(await row({ receivedQuotesCount: '1' })).toObject()
    assert.isTrue(output.hasReceivedQuote)
  })

  test('un devis PDF compte comme devis reçu', async ({ assert }) => {
    const output = new RfqListItemTransformer(await row({ quoteDocumentsCount: 2 })).toObject()
    assert.isTrue(output.hasReceivedQuote)
  })

  test('sans compteur (non chargé), aucun devis reçu', async ({ assert }) => {
    const rfq = await row()
    rfq.$extras = {}
    assert.isFalse(new RfqListItemTransformer(rfq).toObject().hasReceivedQuote)
  })

  test('une demande envoyée sans réponse est « envoyée », sans auteur connu', async ({
    assert,
  }) => {
    const output = new RfqListItemTransformer(
      await row({ sentCount: 1, pendingCount: 1, withAuthor: false })
    ).toObject()
    assert.equal(output.progress, 'sent')
    assert.isNull(output.createdByName)
  })

  test('une demande publiée dont aucun destinataire n’est notifié reste « publiée »', async ({
    assert,
  }) => {
    const output = new RfqListItemTransformer(await row({ pendingCount: 2 })).toObject()
    assert.equal(output.progress, 'published')
  })
})
