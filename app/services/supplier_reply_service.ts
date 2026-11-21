import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import SupplierReplyRecorded from '#events/supplier_reply_recorded'
import InboundMail from '#models/inbound_mail'
import InboundMailAttachment from '#models/inbound_mail_attachment'
import type Message from '#models/message'
import RfqSupplier from '#models/rfq_supplier'
import ConversationService from '#services/conversation_service'
import PdfService from '#services/pdf_service'
import QuoteService from '#services/quote_service'
import RfqService from '#services/rfq_service'
import StorageService from '#services/storage/storage_service'
import SubscriptionService from '#services/subscription_service'
import { htmlToText } from '#shared/helpers/inbound_mail'
import { MESSAGE_MAX_LENGTH } from '#shared/types/conversation'
import { INBOUND_ATTACHMENT_STATUSES } from '#shared/types/inbound_mail'
import type { RecipientStampOptions } from '#shared/types/pdf'
import type { QuoteDocumentInput } from '#shared/types/quote'
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
 *    destinataire passe « répondu » ;
 *  - si le fournisseur n'est pas abonné au moment de la réponse, une copie du
 *    PDF portant le nom de l'agence et la référence de la demande est stockée
 *    à côté (#238) : c'est elle que reçoit l'agence, l'original reste celui
 *    du fournisseur.
 *
 * Tout part du couple demande / fournisseur (`rfq_suppliers`) désigné par
 * l'adresse relais : ni compte ni membre côté fournisseur ne sont requis (#218).
 *
 * `InboundMailReceived` est émis au moins une fois : `record` est idempotent
 * (`messages.inbound_mail_id` unique). Les écritures tiennent en une
 * transaction ; si elle échoue, les fichiers créés ici (PDF compressés,
 * versions destinataires) sont libérés.
 */
@inject()
export default class SupplierReplyService {
  constructor(
    private storage: StorageService,
    private pdf: PdfService,
    private conversations: ConversationService,
    private quotes: QuoteService,
    private rfqs: RfqService,
    private subscriptions: SubscriptionService
  ) {}

  /**
   * Renvoie ce qui a été enregistré, ou `null` si ce mail l'était déjà, n'est
   * rattaché à aucun destinataire, ou n'a ni texte ni fichier à enregistrer.
   */
  async record(inboundMailId: number): Promise<SupplierReplyRecordedData | null> {
    if (await this.conversations.findInboundMessage(inboundMailId)) return null

    const mail = await InboundMail.find(inboundMailId)
    if (!mail?.rfqSupplierId) return null
    const recipient = await RfqSupplier.query()
      .where('id', mail.rfqSupplierId)
      .preload('rfq', (rfq) => rfq.preload('buyerOrganization'))
      .first()
    if (!recipient) return null

    // Ni texte ni fichier conservé (pièces refusées, mail vide) : il n'y a rien
    // à lire dans le fil, le mail reste dans le journal.
    const body = this.bodyOf(mail)
    if (body === '' && !(await this.hasStoredAttachments(mail))) {
      logger.info({ inboundMailId }, 'empty supplier reply not recorded as a message')
      return null
    }

    const attachments = await this.prepareAttachments(mail, await this.recipientStampFor(recipient))
    // Fichiers créés ici : à libérer si rien ne les référence.
    const created = this.createdObjects(attachments)

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
          { inboundMailId, body, attachments },
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
          this.quoteDocumentsOf(message, attachments).map((document) => ({
            ...document,
            rfqId: recipient.rfqId,
            rfqSupplierId: recipient.id,
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
      await this.storage.discard(created)
      throw error
    }

    if (!outcome) {
      // Enregistré entre-temps par un autre traitement : `discard` ne retire
      // que ce que rien ne référence.
      await this.storage.discard(created)
      return null
    }

    await this.storage.dispatchDeletions(outcome.tombstones)
    this.conversations.announce(outcome.reply.conversationId, outcome.reply.messageId)
    await this.publish(outcome.reply)
    return outcome.reply
  }

  private storedAttachments(mail: InboundMail) {
    return InboundMailAttachment.query()
      .where('inboundMailId', mail.id)
      .where('status', INBOUND_ATTACHMENT_STATUSES.stored)
      .whereNotNull('storageObjectId')
  }

  private async hasStoredAttachments(mail: InboundMail): Promise<boolean> {
    return (await this.storedAttachments(mail).select('id').first()) !== null
  }

  /**
   * Pièces jointes stockées du mail, prêtes pour le message. Traitées **une par
   * une** : deux pièces identiques s'enverraient sinon en concurrence. Si l'une
   * échoue, les fichiers déjà créés sont libérés.
   */
  private async prepareAttachments(
    mail: InboundMail,
    stamp: RecipientStampOptions | null
  ): Promise<PreparedReplyAttachment[]> {
    const stored = await this.storedAttachments(mail).preload('storageObject').orderBy('id')

    const prepared: PreparedReplyAttachment[] = []
    try {
      for (const attachment of stored)
        prepared.push(await this.prepareAttachment(attachment, stamp))
    } catch (error) {
      await this.storage.discard(this.createdObjects(prepared))
      throw error
    }
    return prepared
  }

  /**
   * Un PDF est compressé et stocké sous sa propre clé ; si la compression
   * n'apporte rien (`PdfService` ne lève jamais), le fichier reçu est gardé tel
   * quel. Avec `stamp`, sa version destinataire est stockée à côté.
   */
  private async prepareAttachment(
    attachment: InboundMailAttachment,
    stamp: RecipientStampOptions | null
  ): Promise<PreparedReplyAttachment> {
    const received = attachment.storageObject
    const base = {
      inboundAttachmentId: attachment.id,
      receivedObjectId: received.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType ?? received.mimeType,
    }
    if (base.mimeType !== QUOTE_DOCUMENT_MIME_TYPE) {
      return {
        ...base,
        storageObjectId: received.id,
        sizeBytes: received.size,
        recipientObjectId: null,
      }
    }

    const { content, compressed } = await this.pdf.compress(await this.storage.read(received))
    const object = compressed ? await this.storeQuotePdf(content) : received
    try {
      const recipientObjectId = await this.storeRecipientVersion(content, stamp)
      return { ...base, storageObjectId: object.id, sizeBytes: object.size, recipientObjectId }
    } catch (error) {
      if (compressed) await this.storage.discard([object.id])
      throw error
    }
  }

  /**
   * Stocke la copie du PDF portant le nom de l'agence (#238). `null` sans
   * apposition à faire (fournisseur abonné) ou si le PDF n'a pu être modifié :
   * l'agence reçoit alors l'original.
   */
  private async storeRecipientVersion(
    content: Buffer,
    stamp: RecipientStampOptions | null
  ): Promise<number | null> {
    if (!stamp) return null
    const stamped = await this.pdf.stampRecipient(content, stamp)
    if (stamped === content) return null
    const object = await this.storeQuotePdf(stamped)
    return object.id
  }

  private storeQuotePdf(content: Buffer) {
    return this.storage.storeContent(content, 'pdf', QUOTE_DOCUMENT_MIME_TYPE)
  }

  /**
   * Mention à apposer sur les devis de ce destinataire : aucune si son
   * organisation est abonnée **au moment de la réponse** — elle connaît
   * l'agence (#221).
   */
  private async recipientStampFor(recipient: RfqSupplier): Promise<RecipientStampOptions | null> {
    if (await this.subscriptions.isSubscribed(recipient.supplierOrganizationId)) return null
    const { rfq } = recipient
    return { agencyName: rfq.buyerOrganization.name, rfqRef: String(rfq.id) }
  }

  /** Fichiers créés par la préparation : PDF compressés et versions destinataires. */
  private createdObjects(attachments: PreparedReplyAttachment[]): number[] {
    return attachments.flatMap((attachment) => [
      ...(attachment.storageObjectId === attachment.receivedObjectId
        ? []
        : [attachment.storageObjectId]),
      ...(attachment.recipientObjectId === null ? [] : [attachment.recipientObjectId]),
    ])
  }

  /**
   * Devis PDF apportés par le message : ses pièces jointes PDF, avec leur
   * version destinataire. Les pièces du message sont créées dans l'ordre des
   * pièces préparées.
   */
  private quoteDocumentsOf(
    message: Message,
    attachments: PreparedReplyAttachment[]
  ): Array<
    Pick<QuoteDocumentInput, 'messageId' | 'messageAttachmentId' | 'recipientStorageObjectId'>
  > {
    return message.attachments
      .map((attachment, index) => ({ attachment, prepared: attachments[index] }))
      .filter(({ attachment }) => attachment.mimeType === QUOTE_DOCUMENT_MIME_TYPE)
      .map(({ attachment, prepared }) => ({
        messageId: message.id,
        messageAttachmentId: attachment.id,
        recipientStorageObjectId: prepared.recipientObjectId,
      }))
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
