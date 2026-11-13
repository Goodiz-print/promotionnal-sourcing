import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import SupplierReplyRecorded from '#events/supplier_reply_recorded'
import InboundMail from '#models/inbound_mail'
import InboundMailAttachment from '#models/inbound_mail_attachment'
import RfqSupplier from '#models/rfq_supplier'
import ConversationService from '#services/conversation_service'
import PdfService from '#services/pdf_service'
import QuoteService from '#services/quote_service'
import RfqService from '#services/rfq_service'
import StorageService from '#services/storage/storage_service'
import { htmlToText } from '#shared/helpers/inbound_mail'
import { MESSAGE_MAX_LENGTH } from '#shared/types/conversation'
import { INBOUND_ATTACHMENT_STATUSES } from '#shared/types/inbound_mail'
import {
  QUOTE_DOCUMENT_MIME_TYPE,
  type PreparedReplyAttachment,
  type SupplierReplyRecordedData,
} from '#shared/types/supplier_reply'

/**
 * Enregistre la réponse d'un fournisseur reçue par mail (#224, `docs/quotes.md`) :
 *
 *  - le mail devient un **message** du fil de la demande pour ce destinataire ;
 *  - ses pièces jointes acceptées deviennent celles du message — un PDF est
 *    d'abord compressé (`PdfService`) ;
 *  - chaque PDF est enregistré comme **devis du fournisseur**, et le
 *    destinataire passe « répondu ».
 *
 * Tout part du couple demande / fournisseur (`rfq_suppliers`) désigné par
 * l'adresse relais : ni compte ni membre côté fournisseur ne sont requis (#218).
 *
 * `InboundMailReceived` est émis au moins une fois : `record` est idempotent
 * (`messages.inbound_mail_id` unique). Les écritures tiennent en une
 * transaction ; si elle échoue, les fichiers compressés sont libérés.
 */
@inject()
export default class SupplierReplyService {
  constructor(
    private storage: StorageService,
    private pdf: PdfService,
    private conversations: ConversationService,
    private quotes: QuoteService,
    private rfqs: RfqService
  ) {}

  /**
   * Renvoie ce qui a été enregistré, ou `null` si ce mail l'était déjà (ou
   * n'est rattaché à aucun destinataire).
   */
  async record(inboundMailId: number): Promise<SupplierReplyRecordedData | null> {
    if (await this.conversations.findInboundMessage(inboundMailId)) return null

    const mail = await InboundMail.find(inboundMailId)
    if (!mail?.rfqSupplierId) return null
    const recipient = await RfqSupplier.query()
      .where('id', mail.rfqSupplierId)
      .preload('rfq')
      .first()
    if (!recipient) return null

    const attachments = await this.prepareAttachments(mail)
    // Fichiers créés ici (PDF compressés) : à libérer si rien ne les référence.
    const compressed = attachments
      .filter((attachment) => attachment.storageObjectId !== attachment.receivedObjectId)
      .map((attachment) => attachment.storageObjectId)

    let outcome: { reply: SupplierReplyRecordedData; tombstones: Array<number | null> } | null
    try {
      outcome = await db.transaction(async (trx) => {
        // Verrou du destinataire : deux réponses simultanées du même fournisseur
        // n'ouvrent pas deux fils et s'enregistrent l'une après l'autre.
        await RfqSupplier.query({ client: trx }).where('id', recipient.id).forUpdate().firstOrFail()
        if (await this.conversations.findInboundMessage(inboundMailId, trx)) return null

        const conversation = await this.conversations.threadForRecipient(recipient, trx)
        const message = await this.conversations.recordInbound(
          conversation,
          { inboundMailId, body: this.bodyOf(mail), attachments },
          trx
        )

        // Le journal désigne désormais le fichier conservé ; l'original d'un
        // PDF compressé n'a plus de référence et part en purge.
        const tombstones: Array<number | null> = []
        for (const attachment of attachments) {
          if (attachment.storageObjectId === attachment.receivedObjectId) continue
          await InboundMailAttachment.query({ client: trx })
            .where('id', attachment.inboundAttachmentId)
            .update({ storageObjectId: attachment.storageObjectId })
          tombstones.push(await this.storage.release(trx, attachment.receivedObjectId))
        }

        const documents = await this.quotes.recordDocuments(
          message.attachments
            .filter((attachment) => attachment.mimeType === QUOTE_DOCUMENT_MIME_TYPE)
            .map((attachment) => ({
              rfqId: recipient.rfqId,
              rfqSupplierId: recipient.id,
              messageId: message.id,
              messageAttachmentId: attachment.id,
              receivedAt: mail.receivedAt.toJSDate(),
            })),
          trx
        )
        // Sans PDF, c'est un simple message : le statut ne bouge pas.
        const responded =
          documents.length > 0 && (await this.rfqs.markRespondedByMail(recipient, trx))

        return {
          reply: {
            inboundMailId,
            rfqSupplierId: recipient.id,
            conversationId: conversation.id,
            messageId: message.id,
            quoteDocumentIds: documents.map((document) => document.id),
            responded,
          },
          tombstones,
        }
      })
    } catch (error) {
      await this.storage.discard(compressed)
      throw error
    }

    if (!outcome) {
      // Enregistré entre-temps par un autre traitement : `discard` ne retire
      // que ce que rien ne référence.
      await this.storage.discard(compressed)
      return null
    }

    await this.storage.dispatchDeletions(outcome.tombstones)
    this.conversations.announce(outcome.reply.conversationId, outcome.reply.messageId)
    await this.publish(outcome.reply)
    return outcome.reply
  }

  /**
   * Pièces jointes stockées du mail, prêtes pour le message. Un PDF est
   * compressé et stocké sous sa propre clé ; si la compression n'apporte rien
   * (`PdfService` ne lève jamais), le fichier reçu est gardé tel quel.
   */
  private async prepareAttachments(mail: InboundMail): Promise<PreparedReplyAttachment[]> {
    const stored = await InboundMailAttachment.query()
      .where('inboundMailId', mail.id)
      .where('status', INBOUND_ATTACHMENT_STATUSES.stored)
      .whereNotNull('storageObjectId')
      .preload('storageObject')
      .orderBy('id')

    const prepared: PreparedReplyAttachment[] = []
    try {
      for (const attachment of stored) {
        const received = attachment.storageObject
        const base = {
          inboundAttachmentId: attachment.id,
          receivedObjectId: received.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType ?? received.mimeType,
        }

        if (base.mimeType !== QUOTE_DOCUMENT_MIME_TYPE) {
          prepared.push({ ...base, storageObjectId: received.id, sizeBytes: received.size })
          continue
        }

        const { content, compressed } = await this.pdf.compress(await this.storage.read(received))
        const object = compressed
          ? await this.storage.storeContent(content, 'pdf', QUOTE_DOCUMENT_MIME_TYPE)
          : received
        prepared.push({ ...base, storageObjectId: object.id, sizeBytes: object.size })
      }
    } catch (error) {
      await this.storage.discard(
        prepared
          .filter((attachment) => attachment.storageObjectId !== attachment.receivedObjectId)
          .map((attachment) => attachment.storageObjectId)
      )
      throw error
    }
    return prepared
  }

  /**
   * Corps du message : la partie texte du mail, à défaut son HTML réduit à du
   * texte. Borné comme tout message ; le mail complet reste dans `inbound_mails`.
   */
  private bodyOf(mail: InboundMail): string {
    const text = mail.textBody?.trim() || (mail.htmlBody ? htmlToText(mail.htmlBody) : '')
    return text.slice(0, MESSAGE_MAX_LENGTH)
  }

  /**
   * Publie l'événement **après** le commit : un écouteur défaillant ne doit pas
   * faire rejouer un mail déjà enregistré.
   */
  private async publish(reply: SupplierReplyRecordedData): Promise<void> {
    try {
      await emitter.emit(SupplierReplyRecorded, new SupplierReplyRecorded(reply))
    } catch (error) {
      logger.error({ err: error, ...reply }, 'supplier reply listener failed')
    }
  }
}
