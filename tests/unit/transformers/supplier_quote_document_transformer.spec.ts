import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { StorageObjectFactory } from '#database/factories/storage_object_factory'
import Message from '#models/message'
import MessageAttachment from '#models/message_attachment'
import QuoteDocument from '#models/quote_document'
import SupplierQuoteDocumentTransformer from '#transformers/supplier_quote_document_transformer'

/** Devis PDF tel que `QuoteService#documentsSentBy` le charge, version agence comprise. */
async function document(inboundMailId: number | null) {
  const original = await StorageObjectFactory.merge({
    id: 40,
    key: 'promotionnal-sourcing/test/original.pdf',
  }).make()
  const attachment = new MessageAttachment().merge({
    id: 21,
    messageId: 9,
    storageObjectId: 40,
    filename: 'devis-2026.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 123_456,
  })
  attachment.$setRelated('storageObject', original)
  const message = new Message().merge({ id: 9, inboundMailId })

  const quoteDocument = new QuoteDocument().merge({
    id: 3,
    rfqId: 7,
    rfqSupplierId: 12,
    messageId: 9,
    messageAttachmentId: 21,
    recipientStorageObjectId: 41,
    receivedAt: DateTime.fromISO('2026-11-20T09:30:00.000Z', { zone: 'utc' }),
    stampedAt: DateTime.fromISO('2026-11-20T09:30:01.000Z', { zone: 'utc' }),
    selectedAt: DateTime.fromISO('2026-11-21T09:30:00.000Z', { zone: 'utc' }),
  })
  quoteDocument.$setRelated('attachment', attachment)
  quoteDocument.$setRelated('message', message)
  return quoteDocument
}

test.group('SupplierQuoteDocumentTransformer (#230)', () => {
  test('forme exacte : fichier, date d’envoi, reçu par mail', async ({ assert }) => {
    const output = new SupplierQuoteDocumentTransformer(await document(55)).toObject()

    assert.deepEqual(output, {
      id: 3,
      filename: 'devis-2026.pdf',
      sizeBytes: 123_456,
      receivedAt: '2026-11-20T09:30:00.000Z',
      viaMail: true,
    })
  })

  test('un devis déposé depuis l’écran n’est pas « par mail »', async ({ assert }) => {
    const output = new SupplierQuoteDocumentTransformer(await document(null)).toObject()

    assert.isFalse(output.viaMail)
  })

  test('ne laisse fuir ni la version agence, ni la clé de stockage, ni la décision de l’agence', async ({
    assert,
  }) => {
    const output = new SupplierQuoteDocumentTransformer(await document(55)).toObject()
    const json = JSON.stringify(output)

    assert.notProperty(output, 'recipientStorageObjectId')
    assert.notProperty(output, 'stampedAt')
    assert.notProperty(output, 'selectedAt')
    assert.notProperty(output, 'messageId')
    assert.notInclude(json, 'promotionnal-sourcing/')
    assert.notInclude(json, '"41"')
  })
})
