import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { urlFor } from '@adonisjs/core/services/url_builder'
import SendMailJob from '#jobs/send_mail_job'
import Message from '#models/message'
import RfqSupplier from '#models/rfq_supplier'
import InboundAddressService from '#services/inbound_address_service'
import RfqNotificationService from '#services/rfq_notification_service'
import SubscriptionService from '#services/subscription_service'
import SupplierReplyNotificationService from '#services/supplier_reply_notification_service'
import { agencyMessageMail } from '#shared/helpers/agency_message'
import { relayableHeaders } from '#shared/helpers/inbound_mail'
import type {
  AgencyMessageNotice,
  ConversationMessageRecordedData,
} from '#shared/types/conversation'
import type { RfqMailAddress } from '#shared/types/rfq'

/**
 * Relais par mail des messages du fil d'une demande (#226), vers l'autre côté
 * de celui qui a écrit (listener de `ConversationMessageRecorded`) :
 *
 *  - un message de l'**agence** part aux adresses de réception du fournisseur
 *    (`RfqNotificationService#addressesFor`, #217), expéditeur la plateforme,
 *    `Reply-To` l'adresse relais `rfq-` ; l'agence n'est nommée qu'à un abonné ;
 *  - un message du **fournisseur** écrit dans l'application part à l'agence
 *    comme sa réponse par mail (#225, `SupplierReplyNotificationService`).
 *
 * Idempotent (clé du mail par message et destinataire). Un échec de mise en
 * queue est loggué sans être propagé : le message est déjà dans le fil.
 * Renvoie le nombre de mails mis en queue.
 */
@inject()
export default class MessageRelayService {
  constructor(
    private addresses: InboundAddressService,
    private rfqMails: RfqNotificationService,
    private subscriptions: SubscriptionService,
    private supplierReplies: SupplierReplyNotificationService
  ) {}

  async relay(message: ConversationMessageRecordedData): Promise<number> {
    if (message.side === 'agency') return this.toSupplier(message)

    const { mails } = await this.supplierReplies.notify({
      rfqSupplierId: message.rfqSupplierId,
      messageId: message.messageId,
      quoteDocumentIds: [],
      // Un message écrit dans l'application n'est pas une réponse à la demande
      // par mail : la mention « réponse tardive » (#232) ne le concerne pas.
      late: false,
    })
    return mails
  }

  private async toSupplier(message: ConversationMessageRecordedData): Promise<number> {
    const recipient = await RfqSupplier.query()
      .where('id', message.rfqSupplierId)
      .preload('rfq', (rfq) => rfq.preload('buyerOrganization'))
      .preload('supplierOrganization')
      .first()
    if (!recipient) return 0

    const notice = await this.noticeFor(message.messageId, recipient)
    const addresses = await this.rfqMails.addressesFor(recipient)
    const queued = await Promise.all(addresses.map((address) => this.queue(notice, address)))
    return queued.filter(Boolean).length
  }

  /**
   * Message résolu pour le relais : texte, pièces jointes, adresse relais côté
   * fournisseur, et — pour un mail de l'agence — ses en-têtes nettoyés.
   */
  private async noticeFor(messageId: number, recipient: RfqSupplier): Promise<AgencyMessageNotice> {
    const message = await Message.query()
      .where('id', messageId)
      .preload('attachments', (attachments) => attachments.orderBy('id'))
      .preload('inboundMail', (mail) => mail.select('id', 'headers'))
      .firstOrFail()
    const { rfq } = recipient
    const subscribed = await this.subscriptions.isSubscribed(recipient.supplierOrganizationId)

    return {
      rfqId: rfq.id,
      rfqTitle: rfq.title,
      agencyName: subscribed ? rfq.buyerOrganization.name : null,
      messageId: message.id,
      body: message.body,
      attachments: message.attachments.map(({ filename }) => filename),
      replyTo: await this.addresses.addressFor(recipient),
      headers: relayableHeaders(message.inboundMail?.headers ?? {}),
    }
  }

  private async queue(notice: AgencyMessageNotice, address: RfqMailAddress): Promise<boolean> {
    try {
      const rfqPath = urlFor('supplier.rfqs.show', { locale: address.locale, id: notice.rfqId })
      await SendMailJob.dispatch(agencyMessageMail({ notice, address, rfqPath }))
      return true
    } catch (error) {
      logger.warn(
        { err: error, rfqId: notice.rfqId, messageId: notice.messageId },
        'failed to queue agency message relay'
      )
      return false
    }
  }
}
