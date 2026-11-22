import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { urlFor } from '@adonisjs/core/services/url_builder'
import SendMailJob from '#jobs/send_mail_job'
import Message from '#models/message'
import OrganizationUser from '#models/organization_user'
import RfqSupplier from '#models/rfq_supplier'
import InAppNotificationService from '#services/in_app_notification_service'
import InboundAddressService from '#services/inbound_address_service'
import QuoteService from '#services/quote_service'
import { supplierReplyMail } from '#shared/helpers/supplier_reply'
import type { Locale } from '#shared/types/i18n'
import { RFQ_MANAGER_ROLES } from '#shared/types/rfq'
import type Rfq from '#models/rfq'
import type {
  SupplierReplyMailPaths,
  SupplierReplyNotice,
  SupplierReplyNotificationOutcome,
  SupplierReplyRecipient,
  SupplierReplyToNotify,
} from '#shared/types/supplier_reply'

/**
 * Transmet à l'agence la réponse qu'un fournisseur a envoyée par mail (#225),
 * par mail et par notification in-app (listener de `SupplierReplyRecorded`).
 * Sert aussi au relais d'un message que le fournisseur écrit dans
 * l'application (#226, `MessageRelayService`) : même mail, sans devis. Le
 * `Reply-To` est l'adresse relais côté agence : sa réponse revient dans le fil
 * et part vers le fournisseur.
 *
 * Destinataires : l'**auteur** de la demande (`rfqs.created_by_user_id`, #221)
 * et les **responsables** de l'agence (`RFQ_MANAGER_ROLES`), une seule fois
 * chacun. L'auteur n'est prévenu que s'il est encore membre de l'agence.
 *
 * Idempotent : la clé du mail et la notification in-app portent le message du
 * fil — un événement rejoué ne prévient personne deux fois. Un échec est loggué
 * sans être propagé : la réponse est enregistrée et visible dans le fil.
 */
@inject()
export default class SupplierReplyNotificationService {
  constructor(
    private quotes: QuoteService,
    private addresses: InboundAddressService,
    private inApp: InAppNotificationService
  ) {}

  async notify(reply: SupplierReplyToNotify): Promise<SupplierReplyNotificationOutcome> {
    const recipient = await RfqSupplier.query()
      .where('id', reply.rfqSupplierId)
      .preload('rfq')
      .preload('supplierOrganization')
      .first()
    if (!recipient) return { mails: 0, notifications: 0 }

    const notice = await this.noticeFor(reply, recipient)
    const users = await this.recipientsFor(recipient.rfq)
    const mails = await this.sendMails(notice, users)
    const notifications = await this.inApp.supplierReplied(
      users.map(({ userId }) => userId),
      notice
    )
    return { mails, notifications }
  }

  /**
   * L'auteur de la demande et les responsables de l'agence, sans doublon. Une
   * seule requête : l'auteur passe par son adhésion, quel que soit son rôle.
   */
  async recipientsFor(rfq: Rfq): Promise<SupplierReplyRecipient[]> {
    const memberships = await OrganizationUser.query()
      .where('organizationId', rfq.buyerOrganizationId)
      .where((query) => {
        query.whereHas('role', (role) => role.whereIn('slug', [...RFQ_MANAGER_ROLES]))
        if (rfq.createdByUserId) query.orWhere('userId', rfq.createdByUserId)
      })
      .preload('user')
      .orderBy('id')

    const byEmail = new Map(memberships.map(({ user }) => [user.email.toLowerCase(), user]))
    return [...byEmail.values()].map((user) => ({
      userId: user.id,
      email: user.email,
      locale: user.locale as Locale,
    }))
  }

  /** Réponse résolue : message du fil, devis PDF de cette réponse, adresse relais. */
  private async noticeFor(
    reply: SupplierReplyToNotify,
    recipient: RfqSupplier
  ): Promise<SupplierReplyNotice> {
    const message = await Message.findOrFail(reply.messageId)
    const documents = await this.quotes.documentsOfReply(recipient.id, reply.quoteDocumentIds)

    return {
      rfqId: recipient.rfqId,
      rfqTitle: recipient.rfq.title,
      supplierName: recipient.supplierOrganization.name,
      messageId: message.id,
      body: message.body,
      documents: documents.map(({ id, attachment }) => ({ id, filename: attachment.filename })),
      replyTo: await this.addresses.agencyAddressFor(recipient),
      late: reply.late,
    }
  }

  /** Un mail par destinataire, dans sa langue. Renvoie le nombre mis en queue. */
  private async sendMails(
    notice: SupplierReplyNotice,
    users: SupplierReplyRecipient[]
  ): Promise<number> {
    const queued = await Promise.all(users.map((user) => this.sendMail(notice, user)))
    return queued.filter(Boolean).length
  }

  /**
   * Chemins du mail dans la langue du destinataire. Reste dans le service :
   * `urlFor` lit les routes de l'application, que `shared/` ne connaît pas.
   */
  private pathsFor(notice: SupplierReplyNotice, locale: Locale): SupplierReplyMailPaths {
    return {
      rfqPath: urlFor('rfqs.show', { locale, id: notice.rfqId }),
      documentPaths: Object.fromEntries(
        notice.documents.map(({ id }) => [id, urlFor('quote_documents.download', { locale, id })])
      ),
    }
  }

  private async sendMail(
    notice: SupplierReplyNotice,
    user: SupplierReplyRecipient
  ): Promise<boolean> {
    try {
      await SendMailJob.dispatch(
        supplierReplyMail({ notice, user, paths: this.pathsFor(notice, user.locale) })
      )
      return true
    } catch (error) {
      logger.warn(
        { err: error, rfqId: notice.rfqId, messageId: notice.messageId },
        'failed to queue supplier reply notification'
      )
      return false
    }
  }
}
