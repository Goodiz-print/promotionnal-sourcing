import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { RfqSupplierFactory } from '#database/factories/rfq_supplier_factory'
import { StorageObjectFactory } from '#database/factories/storage_object_factory'
import MessageAttachment from '#models/message_attachment'
import QuoteDocument from '#models/quote_document'
import QuoteDocumentTransformer from '#transformers/quote_document_transformer'

async function document(selectedAt: DateTime | null) {
  const supplier = await OrganizationFactory.apply('supplier')
    .merge({ id: 30, name: 'Textiles du Nord' })
    .make()
  const recipient = await RfqSupplierFactory.merge({
    id: 12,
    rfqId: 7,
    supplierOrganizationId: 30,
  }).make()
  recipient.$setRelated('supplierOrganization', supplier)
  const file = await StorageObjectFactory.merge({
    id: 40,
    key: 'promotionnal-sourcing/test/abc.pdf',
  }).make()
  const attachment = new MessageAttachment().merge({
    id: 21,
    messageId: 9,
    storageObjectId: 40,
    filename: 'devis-2026.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 123_456,
  })
  attachment.$setRelated('storageObject', file)

  const quoteDocument = new QuoteDocument().merge({
    id: 3,
    rfqId: 7,
    rfqSupplierId: 12,
    messageId: 9,
    messageAttachmentId: 21,
    recipientStorageObjectId: 41,
    receivedAt: DateTime.fromISO('2026-11-20T09:30:00.000Z', { zone: 'utc' }),
    stampedAt: null,
    selectedAt,
  })
  quoteDocument.$setRelated('rfqSupplier', recipient)
  quoteDocument.$setRelated('attachment', attachment)
  return quoteDocument
}

test.group('QuoteDocumentTransformer (#228)', () => {
  test('forme exacte : fournisseur, fichier, réception, sans sélection', async ({ assert }) => {
    const output = new QuoteDocumentTransformer(await document(null)).toObject()

    assert.deepEqual(output, {
      id: 3,
      rfqSupplierId: 12,
      supplierName: 'Textiles du Nord',
      filename: 'devis-2026.pdf',
      sizeBytes: 123_456,
      receivedAt: '2026-11-20T09:30:00.000Z',
      selectedAt: null,
    })
  })

  test('ne révèle ni clé de stockage, ni message, ni pièce jointe', async ({ assert }) => {
    const output = new QuoteDocumentTransformer(await document(null)).toObject()
    const json = JSON.stringify(output)

    assert.notInclude(json, 'promotionnal-sourcing/test')
    const hidden = [
      'messageId',
      'messageAttachmentId',
      'recipientStorageObjectId',
      'storageObjectId',
      'rfqId',
    ]
    assert.deepEqual(
      hidden.filter((field) => field in output),
      []
    )
  })

  test('un devis retenu porte sa date de sélection', async ({ assert }) => {
    const selectedAt = DateTime.fromISO('2026-11-22T10:00:00.000Z', { zone: 'utc' })
    const output = new QuoteDocumentTransformer(await document(selectedAt)).toObject()
    assert.equal(output.selectedAt, '2026-11-22T10:00:00.000Z')
  })
})
