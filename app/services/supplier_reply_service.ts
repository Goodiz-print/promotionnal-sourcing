import { readFile } from 'node:fs/promises'
import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import SupplierReplyRecorded from '#events/supplier_reply_recorded'
import { InvalidDocumentException } from '#exceptions/document_errors'
import { RfqSupplierNotReplyableException } from '#exceptions/rfq_errors'
import InboundMail from '#models/inbound_mail'
import InboundMailAttachment from '#models/inbound_mail_attachment'
import type Message from '#models/message'
import RfqSupplier from '#models/rfq_supplier'
import type User from '#models/user'
import ConversationService from '#services/conversation_service'
import PdfService from '#services/pdf_service'
import QuoteService from '#services/quote_service'
import RfqRecipientService from '#services/rfq_recipient_service'
import StorageService from '#services/storage/storage_service'
import SubscriptionService from '#services/subscription_service'
import { inboundMailBody } from '#shared/helpers/inbound_mail'
import { hasPdfHeader } from '#shared/helpers/pdf'
import { acceptsQuoteUpload } from '#shared/helpers/supplier_rfq'
import { INBOUND_ATTACHMENT_STATUSES } from '#shared/types/inbound_mail'
import type { RecipientStampOptions } from '#shared/types/pdf'
import type { QuoteDocumentInput, UploadedQuoteDocumentInput } from '#shared/types/quote'
import {
  QUOTE_DOCUMENT_MIME_TYPE,
  type PreparedReplyAttachment,
  type PreparedUpload,
  type QuoteReplyToRecord,
  type SupplierReplyRecordedData,
  type UploadToWrite,
} from '#shared/types/supplier_reply'

/**
 * Enregistre la réponse d’un fournisseur reçue par mail (#224, `docs/quotes.md`) — ou
 * son devis PDF déposé depuis l’écran de la demande (#230, `recordUpload`) :
 *
 *  - le mail devient un **message** du fil de la demande pour ce destinataire ;
 *  - ses pièces jointes acceptées deviennent celles du message — un PDF est
 *    d'abord compressé (`PdfService`) ;
 *  - chaque PDF est enregistré comme **devis du fournisseur**, et le
 *    destinataire passe « répondu » ;
 *  - après l'échéance, la réponse est enregistrée de la même façon, mais
 *    marquée **tardive** (#232) : l'agence en est prévenue comme telle ;
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
    private recipients: RfqRecipientService,
    private subscriptions: SubscriptionService
  ) {}

  /**
   * Réponse reçue par mail. Renvoie ce qui a été enregistré, ou `null` si ce mail l'était déjà, n'est
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
    const body = inboundMailBody(mail.textBody, mail.htmlBody)
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
          { inboundMailId, body, attachments, senderSide: 'supplier' },
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

        // D'après l'heure de réception du mail, pas celle de son traitement.
        const recorded = await this.recordQuoteReply(
          { recipient, message, attachments, receivedAt: mail.receivedAt },
          trx
        )

        return {
          reply: { inboundMailId, conversationId: conversation.id, ...recorded },
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

  /**
   * Devis PDF **déposé depuis l'écran** d'une demande reçue (#230), en
   * alternative à la réponse par mail : même traitement qu'un PDF reçu par
   * mail — compression, copie au nom de l'agence pour un non abonné (#238),
   * message du fil (écrit par `author`), devis enregistré, destinataire
   * « répondu » (tardif après l'échéance, #232), puis `SupplierReplyRecorded`
   * pour la transmission à l'agence (#225).
   *
   * `recipient.rfq` doit être chargée ; le droit de déposer est vérifié avant
   * (ability `canUploadRfqQuoteDocument`). Lève `InvalidDocumentException` si
   * le fichier n'est pas un PDF, `ConversationBlockedException` si le fil est
   * bloqué, `RfqSupplierNotReplyableException` si le destinataire a décliné
   * entre-temps (statut relu sous verrou). En cas d'échec, les fichiers créés ici sont libérés.
   */
  async recordUpload(
    recipient: RfqSupplier,
    author: User,
    upload: UploadedQuoteDocumentInput
  ): Promise<SupplierReplyRecordedData> {
    const content = await this.readUploadedPdf(upload)
    await recipient.rfq.load('buyerOrganization')
    const prepared = await this.prepareUpload(content, upload, recipient)
    const created = [prepared.storageObjectId, prepared.recipientObjectId].filter(
      (id): id is number => id !== null
    )

    let reply: SupplierReplyRecordedData
    try {
      reply = await db.transaction((trx) =>
        this.writeUpload({ recipient, author, prepared, body: upload.body }, trx)
      )
    } catch (error) {
      await this.storage.discard(created)
      throw error
    }

    this.conversations.announce(reply.conversationId, reply.messageId)
    await this.publish(reply)
    return reply
  }

  /** Contenu du fichier déposé ; l'extension ne prouve rien, l'en-tête `%PDF-` si. */
  private async readUploadedPdf(upload: UploadedQuoteDocumentInput): Promise<Buffer> {
    const content = await readFile(upload.tmpPath)
    if (!hasPdfHeader(content)) throw new InvalidDocumentException()
    return content
  }

  /**
   * PDF déposé, compressé (repli sur l'original, `PdfService` ne lève jamais)
   * et stocké, avec sa version destinataire pour un non abonné (#238).
   */
  private async prepareUpload(
    content: Buffer,
    upload: UploadedQuoteDocumentInput,
    recipient: RfqSupplier
  ): Promise<PreparedUpload> {
    const { content: kept } = await this.pdf.compress(content)
    const object = await this.storeQuotePdf(kept)
    try {
      const stamp = await this.recipientStampFor(recipient)
      return {
        storageObjectId: object.id,
        recipientObjectId: await this.storeRecipientVersion(kept, stamp),
        filename: upload.filename,
        mimeType: QUOTE_DOCUMENT_MIME_TYPE,
        sizeBytes: object.size,
      }
    } catch (error) {
      await this.storage.discard([object.id])
      throw error
    }
  }

  /**
   * Écritures du dépôt, sous le verrou du destinataire (comme une réponse par
   * mail) : message du fil avec le PDF, devis, statut du destinataire.
   */
  private async writeUpload(
    { recipient, author, prepared, body }: UploadToWrite<RfqSupplier, User>,
    trx: TransactionClientContract
  ): Promise<SupplierReplyRecordedData> {
    // Statut relu sous verrou : un refus arrivé depuis l'ability l'emporte.
    const locked = await RfqSupplier.query({ client: trx })
      .select('id', 'status')
      .where('id', recipient.id)
      .forUpdate()
      .firstOrFail()
    if (!acceptsQuoteUpload(locked.status)) throw new RfqSupplierNotReplyableException()
    const conversation = await this.conversations.threadForRecipient(recipient, trx)
    const { recipientObjectId, ...attachment } = prepared
    const message = await this.conversations.recordUploaded(
      conversation,
      { authorUserId: author.id, body, attachments: [attachment], senderSide: 'supplier' },
      trx
    )
    const outcome = await this.recordQuoteReply(
      { recipient, message, attachments: [prepared], receivedAt: DateTime.now() },
      trx
    )
    return { inboundMailId: null, conversationId: conversation.id, ...outcome }
  }

  /**
   * Devis PDF d'une réponse (mail ou dépôt) et avancement du destinataire,
   * dans la transaction qui écrit le message. Après l'échéance, la réponse est
   * enregistrée quand même, marquée tardive (#232). Sans PDF, c'est un simple
   * message : le statut ne bouge pas.
   */
  private async recordQuoteReply(
    { recipient, message, attachments, receivedAt }: QuoteReplyToRecord<RfqSupplier, Message>,
    trx: TransactionClientContract
  ): Promise<Omit<SupplierReplyRecordedData, 'inboundMailId' | 'conversationId'>> {
    const documents = await this.quotes.recordDocuments(
      this.quoteDocumentsOf(message, attachments).map((document) => ({
        ...document,
        rfqId: recipient.rfqId,
        rfqSupplierId: recipient.id,
        receivedAt: receivedAt.toJSDate(),
      })),
      trx
    )
    const late = await this.recipients.markLateReply(recipient, trx, receivedAt)
    const responded =
      documents.length > 0 && (await this.recipients.markRespondedWithQuote(recipient, trx))
    return {
      rfqSupplierId: recipient.id,
      messageId: message.id,
      quoteDocumentIds: documents.map((document) => document.id),
      responded,
      late,
    }
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
      const recipientObjectId = await this.storeRecipientVersion(content, stamp, attachment.id)
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
    stamp: RecipientStampOptions | null,
    inboundAttachmentId: number | null = null
  ): Promise<number | null> {
    if (!stamp) return null
    // Pièce jointe du mail dans les logs ; aucune pour un PDF déposé depuis l'écran (#230).
    const logContext = inboundAttachmentId
      ? { ...stamp.logContext, inboundAttachmentId }
      : stamp.logContext
    const stamped = await this.pdf.stampRecipient(content, { ...stamp, logContext })
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
    return {
      agencyName: rfq.buyerOrganization.name,
      rfqRef: String(rfq.id),
      logContext: { rfqId: rfq.id, rfqSupplierId: recipient.id },
    }
  }

  /** Fichiers créés par la préparation : PDF compressés et versions destinataires. */
  private createdObjects(attachments: PreparedReplyAttachment[]): number[] {
    return attachments
      .flatMap((attachment) => {
        const isCompressed = attachment.storageObjectId !== attachment.receivedObjectId
        return [isCompressed ? attachment.storageObjectId : null, attachment.recipientObjectId]
      })
      .filter((id): id is number => id !== null)
  }

  /**
   * Devis PDF apportés par le message : ses pièces jointes PDF, avec la version
   * destinataire de leur fichier. Deux pièces au même fichier ont le même
   * contenu, donc la même version destinataire.
   */
  private quoteDocumentsOf(
    message: Message,
    attachments: Array<Pick<PreparedReplyAttachment, 'storageObjectId' | 'recipientObjectId'>>
  ): Array<
    Pick<QuoteDocumentInput, 'messageId' | 'messageAttachmentId' | 'recipientStorageObjectId'>
  > {
    const recipients = new Map<number | null, number | null>(
      attachments.map((attachment) => [attachment.storageObjectId, attachment.recipientObjectId])
    )
    return message.attachments
      .filter((attachment) => attachment.mimeType === QUOTE_DOCUMENT_MIME_TYPE)
      .map((attachment) => ({
        messageId: message.id,
        messageAttachmentId: attachment.id,
        recipientStorageObjectId: recipients.get(attachment.storageObjectId) ?? null,
      }))
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
