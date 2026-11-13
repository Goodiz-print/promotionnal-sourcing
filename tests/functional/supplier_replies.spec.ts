import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import emitter from '@adonisjs/core/services/emitter'
import { InboundMailFactory } from '#database/factories/inbound_mail_factory'
import SupplierReplyRecorded from '#events/supplier_reply_recorded'
import Conversation from '#models/conversation'
import InboundMail from '#models/inbound_mail'
import Message from '#models/message'
import MessageAttachment from '#models/message_attachment'
import OrganizationUser from '#models/organization_user'
import QuoteDocument from '#models/quote_document'
import StorageObject from '#models/storage_object'
import InboundMailService from '#services/inbound_mail_service'
import QuoteService from '#services/quote_service'
import RfqService from '#services/rfq_service'
import SupplierReplyService from '#services/supplier_reply_service'
import { MESSAGE_MAX_LENGTH } from '#shared/types/conversation'
import { deliver, sentRfq, useFakeInboundMail } from '#tests/utils/inbound_mail'
import { pdfBuffer, useFakeGhostscript } from '#tests/utils/pdf'
import { useDatabase } from '#tests/utils/setup'
import { sha256, useFakeStorage } from '#tests/utils/storage'

/** Deux devis distincts de 200 octets ; le compresseur factice les réduit à 100. */
const QUOTE_PDF = pdfBuffer(200).toString()
const REVISED_PDF = QUOTE_PDF.replace('1.4', '1.7')

/** Classeur minimal : l'en-tête ZIP d'un `.xlsx`. */
const SPREADSHEET = 'PK\u0003\u0004 tarifs'

/** `QuoteService` dont l'enregistrement des devis PDF échoue en pleine transaction. */
class FailingQuoteService extends QuoteService {
  recordDocuments(): never {
    throw new Error('écriture du devis impossible')
  }
}

test.group('Réponse du fournisseur reçue par mail', (group) => {
  useDatabase(group)
  const inbound = useFakeInboundMail(group)
  const storage = useFakeStorage(group)
  useFakeGhostscript(group)

  test('une réponse avec PDF crée un message, une pièce jointe compressée, un devis, et passe le destinataire à « répondu »', async ({
    client,
    assert,
    cleanup,
  }) => {
    const { rfq, supplier, recipient, address } = await sentRfq()
    const events: SupplierReplyRecorded[] = []
    cleanup(
      emitter.on(SupplierReplyRecorded, (event) => {
        events.push(event)
      })
    )
    inbound.provider.add('mail-1', {
      to: address,
      text: '  Bonjour, voici notre devis.  ',
      attachments: [{ filename: 'devis-2026.pdf', content: QUOTE_PDF }],
    })

    const response = await deliver(client, 'mail-1')

    response.assertStatus(200)
    const journal = await InboundMail.query().preload('attachments').firstOrFail()
    assert.equal(journal.status, 'processed')

    // Le fil de la demande pour ce destinataire, ouvert par la réponse.
    const conversation = await Conversation.query().firstOrFail()
    assert.equal(conversation.rfqSupplierId, recipient.id)
    assert.equal(conversation.rfqId, rfq.id)
    assert.equal(conversation.buyerOrganizationId, rfq.buyerOrganizationId)
    assert.equal(conversation.supplierOrganizationId, supplier.id)
    assert.equal(conversation.subject, rfq.title)

    const message = await Message.query().preload('attachments').firstOrFail()
    assert.equal(message.conversationId, conversation.id)
    assert.equal(message.inboundMailId, journal.id)
    assert.isNull(message.authorUserId)
    assert.equal(message.body, 'Bonjour, voici notre devis.')

    // La pièce jointe du message est le PDF compressé, stocké sous sa propre clé.
    const [attachment] = message.attachments
    assert.lengthOf(message.attachments, 1)
    assert.equal(attachment.filename, 'devis-2026.pdf')
    assert.equal(attachment.mimeType, 'application/pdf')
    assert.equal(attachment.sizeBytes, 100)
    const object = await StorageObject.findOrFail(attachment.storageObjectId!)
    assert.equal(object.status, 'ready')
    assert.equal(storage.driver.objects.get(object.key)?.content.length, 100)

    // Le journal désigne le fichier conservé ; l'original est purgé.
    assert.equal(journal.attachments[0].storageObjectId, object.id)
    const originalKey = [...storage.driver.puts].find((key) => key.includes(sha256(QUOTE_PDF)))!
    assert.isFalse(storage.driver.objects.has(originalKey))
    assert.lengthOf(await StorageObject.query().where('status', 'ready'), 1)

    const [document] = await QuoteDocument.all()
    assert.equal(document.rfqId, rfq.id)
    assert.equal(document.rfqSupplierId, recipient.id)
    assert.equal(document.messageId, message.id)
    assert.equal(document.messageAttachmentId, attachment.id)

    await recipient.refresh()
    assert.equal(recipient.status, 'responded')

    assert.lengthOf(events, 1)
    assert.deepEqual(events[0].reply, {
      inboundMailId: journal.id,
      rfqSupplierId: recipient.id,
      conversationId: conversation.id,
      messageId: message.id,
      quoteDocumentIds: [document.id],
      responded: true,
    })
  })

  test('une réponse sans pièce jointe est un simple message, sans changer le statut', async ({
    client,
    assert,
  }) => {
    const { recipient, address } = await sentRfq()
    inbound.provider.add('mail-1', { to: address, text: 'Quel est le délai souhaité ?' })

    await deliver(client, 'mail-1')

    const message = await Message.query().preload('attachments').firstOrFail()
    assert.equal(message.body, 'Quel est le délai souhaité ?')
    assert.lengthOf(message.attachments, 0)
    assert.lengthOf(await QuoteDocument.all(), 0)
    await recipient.refresh()
    assert.equal(recipient.status, 'sent')
  })

  test('une pièce jointe qui n’est pas un PDF est jointe au message sans valoir devis', async ({
    client,
    assert,
  }) => {
    const { recipient, address } = await sentRfq()
    inbound.provider.add('mail-1', {
      to: address,
      attachments: [{ filename: 'tarifs.xlsx', content: SPREADSHEET }],
    })

    await deliver(client, 'mail-1')

    const journal = await InboundMail.query().preload('attachments').firstOrFail()
    const [attachment] = await MessageAttachment.all()
    // Même fichier que celui du journal : rien n'est stocké une seconde fois.
    assert.equal(attachment.storageObjectId, journal.attachments[0].storageObjectId)
    assert.equal(attachment.filename, 'tarifs.xlsx')
    assert.lengthOf(storage.driver.puts, 1)
    assert.lengthOf(storage.driver.deletes, 0)
    assert.lengthOf(await QuoteDocument.all(), 0)
    await recipient.refresh()
    assert.equal(recipient.status, 'sent')
  })

  test('plusieurs devis successifs : le dernier fait foi, les précédents restent consultables', async ({
    client,
    assert,
  }) => {
    const { recipient, address } = await sentRfq()
    inbound.provider.add('mail-1', {
      to: address,
      receivedAt: '2026-11-10T09:00:00Z',
      attachments: [{ filename: 'devis-v1.pdf', content: QUOTE_PDF }],
    })
    inbound.provider.add('mail-2', {
      to: address,
      receivedAt: '2026-11-12T09:00:00Z',
      text: 'Devis corrigé.',
      attachments: [{ filename: 'devis-v2.pdf', content: REVISED_PDF }],
    })

    await deliver(client, 'mail-1')
    await deliver(client, 'mail-2')

    // Un seul fil pour le couple, deux messages.
    assert.lengthOf(await Conversation.all(), 1)
    assert.lengthOf(await Message.all(), 2)

    const quotes = await app.container.make(QuoteService)
    const all = await quotes.documentsFor(recipient.id)
    assert.deepEqual(
      all.map((document) => document.attachment.filename),
      ['devis-v2.pdf', 'devis-v1.pdf']
    )
    // Les deux fichiers sont toujours sur Cellar.
    for (const document of all) {
      assert.isTrue(storage.driver.objects.has(document.attachment.storageObject.key))
    }

    const current = await quotes.currentDocumentsFor(recipient.id)
    assert.deepEqual(
      current.map((document) => document.attachment.filename),
      ['devis-v2.pdf']
    )
    await recipient.refresh()
    assert.equal(recipient.status, 'responded')
  })

  test('un mail rejoué n’est enregistré qu’une fois', async ({ client, assert, cleanup }) => {
    const { address } = await sentRfq()
    let emitted = 0
    cleanup(
      emitter.on(SupplierReplyRecorded, () => {
        emitted += 1
      })
    )
    inbound.provider.add('mail-1', {
      to: address,
      attachments: [{ filename: 'devis.pdf', content: QUOTE_PDF }],
    })
    await deliver(client, 'mail-1')
    const journal = await InboundMail.firstOrFail()
    const puts = storage.driver.puts.length

    // `InboundMailReceived` est émis au moins une fois : l'écouteur est rappelé.
    const replies = await app.container.make(SupplierReplyService)
    assert.isNull(await replies.record(journal.id))

    assert.lengthOf(await Message.all(), 1)
    assert.lengthOf(await MessageAttachment.all(), 1)
    assert.lengthOf(await QuoteDocument.all(), 1)
    assert.equal(storage.driver.puts.length, puts)
    assert.equal(emitted, 1)
  })

  test('un échec en pleine transaction n’enregistre rien et ne laisse aucun fichier orphelin ; la relance aboutit', async ({
    assert,
  }) => {
    const { recipient, address } = await sentRfq()
    const journal = await InboundMailFactory.merge({
      providerMessageId: inbound.provider.add('mail-1', {
        to: address,
        attachments: [{ filename: 'devis.pdf', content: QUOTE_PDF }],
      }),
      recipient: address,
    }).create()
    // Appel direct du service : en test la file est synchrone et rejouerait le
    // job en attendant son backoff.
    const inboundMails = await app.container.make(InboundMailService)
    app.container.swap(
      QuoteService,
      async (resolver) => new FailingQuoteService(await resolver.make(RfqService))
    )

    await assert.rejects(() => inboundMails.process(journal.id), 'écriture du devis impossible')
    app.container.restore(QuoteService)

    await journal.refresh()
    assert.equal(journal.status, 'failed')
    assert.lengthOf(await Conversation.all(), 0)
    assert.lengthOf(await Message.all(), 0)
    assert.lengthOf(await MessageAttachment.all(), 0)
    assert.lengthOf(await QuoteDocument.all(), 0)
    await recipient.refresh()
    assert.equal(recipient.status, 'sent')
    // Le PDF compressé, que plus rien ne référence, a été retiré de Cellar ;
    // il ne reste que le fichier reçu, référencé par le journal.
    assert.lengthOf(storage.driver.puts, 2)
    assert.deepEqual(
      [...storage.driver.objects.keys()],
      [storage.driver.puts.find((key) => key.includes(sha256(QUOTE_PDF)))]
    )
    assert.lengthOf(await StorageObject.query().whereNot('status', 'ready'), 0)

    // La relance du job aboutit, sans doublon.
    await inboundMails.process(journal.id)
    await journal.refresh()
    assert.equal(journal.status, 'processed')
    assert.lengthOf(await Message.all(), 1)
    assert.lengthOf(await QuoteDocument.all(), 1)
    await recipient.refresh()
    assert.equal(recipient.status, 'responded')
    assert.equal(storage.driver.objects.size, 1)
  }).cleanup(() => app.container.restore(QuoteService))

  test('le dispositif ne suppose ni compte ni membre côté fournisseur', async ({
    client,
    assert,
  }) => {
    const { supplier, recipient, address } = await sentRfq()
    inbound.provider.add('mail-1', {
      to: address,
      from: 'Compta <compta@autre-boite.test>',
      attachments: [{ filename: 'devis.pdf', content: QUOTE_PDF }],
    })

    await deliver(client, 'mail-1')

    assert.lengthOf(await OrganizationUser.query().where('organizationId', supplier.id), 0)
    const journal = await InboundMail.firstOrFail()
    assert.isFalse(journal.senderKnown)
    const message = await Message.firstOrFail()
    assert.isNull(message.authorUserId)
    assert.lengthOf(await QuoteDocument.query().where('rfqSupplierId', recipient.id), 1)
    await recipient.refresh()
    assert.equal(recipient.status, 'responded')
  })

  test('une réponse à une demande échue est enregistrée, sans changer le statut', async ({
    client,
    assert,
  }) => {
    // Adresse encore valide (délai de grâce), mais la demande n'attend plus de réponse.
    const { recipient, address } = await sentRfq('expired')
    inbound.provider.add('mail-1', {
      to: address,
      attachments: [{ filename: 'devis.pdf', content: QUOTE_PDF }],
    })

    await deliver(client, 'mail-1')

    assert.lengthOf(await Message.all(), 1)
    assert.lengthOf(await QuoteDocument.all(), 1)
    await recipient.refresh()
    assert.equal(recipient.status, 'sent')
  })

  test('un mail sans partie texte donne le texte de son HTML, borné à la taille d’un message', async ({
    client,
    assert,
  }) => {
    const { address } = await sentRfq()
    inbound.provider.add('mail-1', {
      to: address,
      text: '',
      html: '<style>p{color:red}</style><p>Bonjour,</p><p>Prix&nbsp;: 12&nbsp;&euro; &amp; port offert<br>Cordialement</p>',
    })
    inbound.provider.add('mail-2', { to: address, text: 'a'.repeat(MESSAGE_MAX_LENGTH + 50) })

    await deliver(client, 'mail-1')
    await deliver(client, 'mail-2')

    const [fromHtml, long] = await Message.query().orderBy('id')
    assert.equal(fromHtml.body, 'Bonjour,\nPrix : 12 € & port offert\nCordialement')
    assert.lengthOf(long.body, MESSAGE_MAX_LENGTH)
  })
})
