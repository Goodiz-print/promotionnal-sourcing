import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import InboundMail from '#models/inbound_mail'
import InboundMailAttachment from '#models/inbound_mail_attachment'
import RfqSupplier from '#models/rfq_supplier'
import ConversationService from '#services/conversation_service'
import InAppNotificationService from '#services/in_app_notification_service'
import RfqThreadService from '#services/rfq_thread_service'
import SupplierReplyNotificationService from '#services/supplier_reply_notification_service'
import { inboundMailBody } from '#shared/helpers/inbound_mail'
import { INBOUND_ATTACHMENT_STATUSES, INBOUND_MAIL_REJECTIONS } from '#shared/types/inbound_mail'
import type {
  ConversationMessageRecordedData,
  InboundMessageInput,
  MessageAttachmentInput,
} from '#shared/types/conversation'

/**
 * Enregistre le mail qu'une agence a envoyé à l'adresse relais `agency-` d'un
 * couple demande / fournisseur (#226) — en général sa réponse au mail qui lui
 * a transmis celle du fournisseur (#225) :
 *
 *  - le mail devient un **message de l'agence** dans le fil de la demande, avec
 *    ses pièces jointes acceptées (fichiers déjà sur Cellar, gardés tels quels :
 *    ce ne sont pas des devis) ;
 *  - le message est ensuite annoncé (`ConversationMessageRecorded`) pour être
 *    relayé au fournisseur (`MessageRelayService`).
 *
 * Le corps n'est pas filtré : le client accepte qu'une signature dans le texte
 * révèle l'agence. Seuls les en-têtes sont écartés au relais.
 *
 * `InboundMailReceived` est émis au moins une fois : `record` est idempotent
 * (`messages.inbound_mail_id` unique), et le relais l'est aussi (clé du mail).
 */
@inject()
export default class AgencyReplyService {
  constructor(
    private conversations: ConversationService,
    private threads: RfqThreadService,
    private supplierReplies: SupplierReplyNotificationService,
    private inApp: InAppNotificationService
  ) {}

  /**
   * Renvoie le message enregistré, ou `null` si ce mail l'était déjà, n'est
   * rattaché à aucun destinataire, ou n'a ni texte ni fichier.
   */
  async record(inboundMailId: number): Promise<ConversationMessageRecordedData | null> {
    if (await this.conversations.findInboundMessage(inboundMailId)) return null

    const mail = await InboundMail.find(inboundMailId)
    if (!mail?.rfqSupplierId) return null
    const recipient = await RfqSupplier.query()
      .where('id', mail.rfqSupplierId)
      .preload('rfq')
      .first()
    if (!recipient) return null

    const body = inboundMailBody(mail.textBody, mail.htmlBody)
    const attachments = await this.attachmentsOf(mail)
    if (body === '' && attachments.length === 0) {
      logger.info({ inboundMailId }, 'empty agency message not recorded')
      return null
    }

    const recorded = await this.store(recipient, { inboundMailId, body, attachments })
    if (!recorded) return null

    this.conversations.announce(recorded.conversationId, recorded.messageId)
    await this.threads.publish(recorded)
    return recorded
  }

  /**
   * Prévient l'agence qu'un mail envoyé à son adresse relais n'a pas été
   * relayé, faute d'expéditeur reconnu (`unknown_sender`) : l'auteur de la
   * demande et ses responsables (les destinataires de #225) reçoivent une
   * notification qui renvoie vers la demande. Jamais de réponse à l'expéditeur,
   * qui peut être falsifié. Idempotent. Renvoie le nombre de notifications.
   */
  async refuse(inboundMailId: number): Promise<number> {
    const mail = await InboundMail.query()
      .where('id', inboundMailId)
      .where('rejectionReason', INBOUND_MAIL_REJECTIONS.unknownSender)
      .select('id', 'senderAddress', 'rfqSupplierId')
      .first()
    if (!mail?.rfqSupplierId) return 0
    const recipient = await RfqSupplier.query()
      .where('id', mail.rfqSupplierId)
      .preload('rfq')
      .preload('supplierOrganization')
      .first()
    if (!recipient) return 0

    const users = await this.supplierReplies.recipientsFor(recipient.rfq)
    return this.inApp.agencyMailRefused(
      users.map(({ userId }) => userId),
      {
        inboundMailId: mail.id,
        rfqId: recipient.rfq.id,
        rfqTitle: recipient.rfq.title,
        supplierName: recipient.supplierOrganization.name,
        senderAddress: mail.senderAddress,
      }
    )
  }

  /**
   * Écrit le message dans le fil du destinataire, sous son verrou (un seul fil
   * par destinataire, même verrou que la réponse du fournisseur). `null` si un
   * traitement concurrent l'a déjà écrit.
   */
  private store(
    recipient: RfqSupplier,
    input: Omit<InboundMessageInput, 'senderSide'>
  ): Promise<ConversationMessageRecordedData | null> {
    return db.transaction(async (trx) => {
      await RfqSupplier.query({ client: trx }).where('id', recipient.id).forUpdate().firstOrFail()
      if (await this.conversations.findInboundMessage(input.inboundMailId, trx)) return null

      const conversation = await this.conversations.threadForRecipient(recipient, trx)
      const message = await this.conversations.recordInbound(
        conversation,
        { ...input, senderSide: 'agency' },
        trx
      )
      return {
        rfqSupplierId: recipient.id,
        conversationId: conversation.id,
        messageId: message.id,
        side: 'agency' as const,
      }
    })
  }

  /** Pièces jointes stockées du mail, prêtes pour le message. */
  private async attachmentsOf(mail: InboundMail): Promise<MessageAttachmentInput[]> {
    const stored = await InboundMailAttachment.query()
      .where('inboundMailId', mail.id)
      .where('status', INBOUND_ATTACHMENT_STATUSES.stored)
      .whereNotNull('storageObjectId')
      .preload('storageObject')
      .orderBy('id')
    return stored.map((attachment) => ({
      storageObjectId: attachment.storageObject.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType ?? attachment.storageObject.mimeType,
      sizeBytes: attachment.storageObject.size,
    }))
  }
}
