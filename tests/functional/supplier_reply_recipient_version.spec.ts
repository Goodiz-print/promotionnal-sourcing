import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import { PDFDocument } from 'pdf-lib'
import { InboundMailFactory } from '#database/factories/inbound_mail_factory'
import MessageAttachment from '#models/message_attachment'
import QuoteDocument from '#models/quote_document'
import StorageObject from '#models/storage_object'
import InboundMailService from '#services/inbound_mail_service'
import QuoteService from '#services/quote_service'
import RfqService from '#services/rfq_service'
import RfqRecipientService from '#services/rfq_recipient_service'
import StorageService from '#services/storage/storage_service'
import { RECIPIENT_BANNER_HEIGHT } from '#shared/types/pdf'
import { deliver, sentRfq, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { subscribeOrganization } from '#tests/utils/organizations'
import { realPdf, signedPdf, useFakeGhostscript } from '#tests/utils/pdf'
import { useDatabase } from '#tests/utils/setup'
import { sha256, useFakeStorage } from '#tests/utils/storage'

/** `QuoteService` dont l'enregistrement des devis PDF échoue en pleine transaction. */
class FailingQuoteService extends QuoteService {
  recordDocuments(): never {
    throw new Error('écriture du devis impossible')
  }
}

/** Devis enregistré avec ses fichiers, tel que l'agence le retrouvera (#225). */
async function recordedDocument(): Promise<QuoteDocument> {
  const { rfqSupplierId } = await QuoteDocument.firstOrFail()
  const quotes = await app.container.make(QuoteService)
  const [document] = await quotes.documentsFor(rfqSupplierId)
  return document
}

async function contentOf(object: StorageObject): Promise<Buffer> {
  const storage = await app.container.make(StorageService)
  return storage.read(object)
}

test.group('Réponse par mail — version destinataire du devis (#238)', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  useFakeStorage(group)
  // Sans compression : le PDF reçu reste un vrai PDF, que `pdf-lib` sait lire.
  useFakeGhostscript(group, { available: false })

  test('le devis d’un fournisseur non abonné reçoit une copie au nom de l’agence ; le fournisseur garde l’original', async ({
    client,
    assert,
  }) => {
    const { address } = await sentRfq()
    const original = await realPdf({ pages: 2 })
    inbound.provider.add('mail-1', {
      to: address,
      attachments: [{ filename: 'devis.pdf', content: original }],
    })

    await deliver(client, 'mail-1')

    const document = await recordedDocument()
    assert.isNotNull(document.recipientStorageObjectId)
    assert.isNotNull(document.stampedAt)
    // Le fil (vu par le fournisseur) désigne le PDF d'origine, intact.
    const attachment = await MessageAttachment.query().preload('storageObject').firstOrFail()
    assert.equal(attachment.storageObject.checksum, sha256(original))
    assert.notEqual(document.recipientStorageObjectId, attachment.storageObjectId)

    // L'agence reçoit la version bandée : première page agrandie, rien d'autre.
    assert.equal(document.recipientFile.id, document.recipientStorageObjectId)
    const stamped = await PDFDocument.load(await contentOf(document.recipientFile))
    assert.equal(stamped.getPageCount(), 2)
    assert.closeTo(stamped.getPage(0).getHeight(), 841.89 + RECIPIENT_BANNER_HEIGHT, 0.01)
  })

  test('le devis d’un fournisseur abonné n’est pas modifié', async ({ client, assert }) => {
    const { supplier, address } = await sentRfq()
    await subscribeOrganization(supplier)
    const original = await realPdf()
    inbound.provider.add('mail-1', {
      to: address,
      attachments: [{ filename: 'devis.pdf', content: original }],
    })

    await deliver(client, 'mail-1')

    const document = await recordedDocument()
    assert.isNull(document.recipientStorageObjectId)
    assert.isNull(document.stampedAt)
    assert.equal(document.recipientFile.checksum, sha256(original))
    assert.lengthOf(await StorageObject.all(), 1)
  })

  test('un PDF signé est transmis tel quel à l’agence, sans erreur', async ({ client, assert }) => {
    const { address } = await sentRfq()
    const original = await signedPdf()
    inbound.provider.add('mail-1', {
      to: address,
      attachments: [{ filename: 'devis.pdf', content: original }],
    })

    const response = await deliver(client, 'mail-1')

    response.assertStatus(200)
    const document = await recordedDocument()
    assert.isNull(document.recipientStorageObjectId)
    assert.equal(document.recipientFile.checksum, sha256(original))
  })

  test('un échec en pleine transaction libère la version destinataire : aucun fichier orphelin', async ({
    assert,
  }) => {
    const { address } = await sentRfq()
    const original = await realPdf()
    const journal = await InboundMailFactory.merge({
      providerMessageId: inbound.provider.add('mail-1', {
        to: address,
        attachments: [{ filename: 'devis.pdf', content: original }],
      }),
      recipient: address,
    }).create()
    const inboundMails = await app.container.make(InboundMailService)
    app.container.swap(
      QuoteService,
      async (resolver) =>
        new FailingQuoteService(
          await resolver.make(RfqService),
          await resolver.make(RfqRecipientService)
        )
    )

    await assert.rejects(() => inboundMails.process(journal.id), 'écriture du devis impossible')

    assert.lengthOf(await QuoteDocument.all(), 0)
    // Seul reste le fichier reçu, référencé par le journal des mails.
    const objects = await StorageObject.query().where('status', 'ready')
    assert.deepEqual(
      objects.map((object) => object.checksum),
      [sha256(original)]
    )
  }).cleanup(() => app.container.restore(QuoteService))
})
