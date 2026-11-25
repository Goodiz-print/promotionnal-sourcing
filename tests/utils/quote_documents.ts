import { DateTime } from 'luxon'
import { ConversationFactory } from '#database/factories/conversation_factory'
import { MessageFactory } from '#database/factories/message_factory'
import { StorageObjectFactory } from '#database/factories/storage_object_factory'
import Conversation from '#models/conversation'
import MessageAttachment from '#models/message_attachment'
import QuoteDocument from '#models/quote_document'
import type Rfq from '#models/rfq'
import type RfqSupplier from '#models/rfq_supplier'

interface ReceivedQuoteDocumentOptions {
  filename?: string
  receivedAt?: DateTime
}

/**
 * Devis PDF reçu d'un destinataire (#224), sans passer par la réception de
 * mail : fil de la demande, message du fournisseur, fichier stocké, pièce
 * jointe et devis. Pour les écrans et services qui lisent les devis reçus
 * (« Mes demandes », #228) ; la réception elle-même est couverte par
 * `supplier_replies.spec.ts`.
 */
export async function receivedQuoteDocument(
  rfq: Rfq,
  recipient: RfqSupplier,
  { filename = 'devis.pdf', receivedAt = DateTime.now() }: ReceivedQuoteDocumentOptions = {}
): Promise<QuoteDocument> {
  const conversation = await threadOf(rfq, recipient)
  const message = await MessageFactory.merge({
    conversationId: conversation.id,
    authorUserId: null,
  }).create()
  const file = await StorageObjectFactory.merge({ mimeType: 'application/pdf' }).create()
  const attachment = await MessageAttachment.create({
    messageId: message.id,
    storageObjectId: file.id,
    filename,
    mimeType: 'application/pdf',
    sizeBytes: file.size,
  })

  return QuoteDocument.create({
    rfqId: rfq.id,
    rfqSupplierId: recipient.id,
    messageId: message.id,
    messageAttachmentId: attachment.id,
    receivedAt,
    recipientStorageObjectId: null,
    stampedAt: null,
    selectedAt: null,
  })
}

/** Fil du destinataire (un seul par destinataire), créé au premier devis. */
async function threadOf(rfq: Rfq, recipient: RfqSupplier): Promise<Conversation> {
  const existing = await Conversation.findBy('rfqSupplierId', recipient.id)
  if (existing) return existing
  return ConversationFactory.merge({
    buyerOrganizationId: rfq.buyerOrganizationId,
    supplierOrganizationId: recipient.supplierOrganizationId,
    rfqId: rfq.id,
    rfqSupplierId: recipient.id,
  }).create()
}
