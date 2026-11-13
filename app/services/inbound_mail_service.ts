import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import inboundMailConfig from '#config/inbound_mail'
import env from '#start/env'
import InboundMailReceived from '#events/inbound_mail_received'
import { InboundMailNotFoundException } from '#exceptions/inbound_mail_errors'
import ProcessInboundMailJob from '#jobs/process_inbound_mail_job'
import InboundMail from '#models/inbound_mail'
import InboundMailAttachment from '#models/inbound_mail_attachment'
import OrganizationUser from '#models/organization_user'
import RfqSupplier from '#models/rfq_supplier'
import InboundAddressService from '#services/inbound_address_service'
import InboundMailProvider from '#services/inbound_mail/inbound_mail_provider'
import StorageService from '#services/storage/storage_service'
import {
  acceptedAttachmentType,
  fileExtension,
  isAutomaticReply,
  parseMailAddress,
} from '#shared/helpers/inbound_mail'
import {
  INBOUND_ATTACHMENT_STATUSES,
  INBOUND_MAIL_REJECTIONS,
  INBOUND_MAIL_STATUSES,
  type InboundAttachmentDescriptor,
  type InboundAttachmentStatus,
  type InboundMailContent,
  type InboundMailNotification,
  type InboundMailReceipt,
  type InboundMailRejection,
  type InboundWebhookHeaders,
} from '#shared/types/inbound_mail'

/** Lit le contenu d'une pièce jointe (prestataire, ou fichier local en simulation). */
type AttachmentLoader = (attachment: InboundAttachmentDescriptor) => Promise<Buffer>

/**
 * Réception des mails entrants (#223, `docs/mail.md`) : la réponse d'un
 * fournisseur à l'adresse relais d'une demande de devis.
 *
 * Deux temps, pour que le webhook réponde vite et que rien ne se perde :
 *
 *  1. `receive` (requête HTTP) authentifie le webhook, **journalise** le mail et
 *     met son traitement en file. `(provider, provider_message_id)` est unique :
 *     le même mail livré deux fois ne donne qu'une ligne et qu'un traitement.
 *  2. `process` (worker) lit le contenu chez le prestataire, applique les
 *     garde-fous, rattache le mail à son couple demande / fournisseur, copie les
 *     pièces jointes acceptées sur Cellar et émet `InboundMailReceived`.
 *
 * Ce service s'arrête là : interpréter la réponse comme un devis (#224) ou la
 * transmettre à l'agence (#225) est l'affaire des écouteurs de l'événement.
 */
@inject()
export default class InboundMailService {
  constructor(
    private provider: InboundMailProvider,
    private addresses: InboundAddressService,
    private storage: StorageService
  ) {}

  /**
   * Webhook du prestataire. Lève si la signature est invalide — rien n'est
   * alors journalisé. Une adresse inconnue est journalisée comme les autres :
   * c'est le worker qui l'écarte.
   */
  async receive(rawBody: string, headers: InboundWebhookHeaders): Promise<InboundMailReceipt> {
    const notification = this.provider.parseWebhook(rawBody, headers)
    if (!notification) return 'ignored'

    const { id, created } = await this.journal(this.provider.name, notification)
    if (!created) {
      // Déjà journalisé. S'il attend encore son traitement (mise en file ratée
      // lors de la première livraison), cette relance le remet en file.
      const pending = await InboundMail.query()
        .where('id', id)
        .where('status', INBOUND_MAIL_STATUSES.received)
        .first()
      if (pending) await ProcessInboundMailJob.dispatch({ inboundMailId: id })
      return 'duplicate'
    }

    await ProcessInboundMailJob.dispatch({ inboundMailId: id })
    return 'queued'
  }

  /** Traite un mail journalisé, en lisant son contenu chez le prestataire. */
  async process(inboundMailId: number): Promise<void> {
    await this.handle(
      inboundMailId,
      (mail) => this.provider.fetchContent(mail.providerMessageId),
      (mail) => (attachment) => this.provider.fetchAttachment(mail.providerMessageId, attachment.id)
    )
  }

  /**
   * Journalise et traite sur-le-champ un mail dont le contenu est déjà connu,
   * sans prestataire ni file (`node ace inbound-mail:simulate`, développement).
   */
  async ingest(
    notification: InboundMailNotification,
    content: InboundMailContent,
    loadAttachment: AttachmentLoader
  ): Promise<InboundMail> {
    const { id } = await this.journal('simulated', notification)
    await this.handle(
      id,
      async () => content,
      () => loadAttachment
    )
    return InboundMail.query().where('id', id).preload('attachments').firstOrFail()
  }

  /**
   * `INSERT … ON CONFLICT DO NOTHING` : renvoie la ligne du mail, et si cet
   * appel vient de la créer.
   */
  private async journal(
    provider: string,
    notification: InboundMailNotification
  ): Promise<{ id: number; created: boolean }> {
    const sender = parseMailAddress(notification.from)
    const token = this.addresses.tokenFrom(notification.recipients)
    const now = new Date()

    const inserted = await db
      .table(InboundMail.table)
      .insert({
        provider,
        provider_message_id: notification.providerMessageId,
        message_id: notification.messageId,
        recipient:
          notification.recipients.find((address) => this.addresses.isRelayAddress(address)) ??
          notification.recipients[0] ??
          null,
        sender_address: sender.address,
        sender_name: sender.name,
        subject: notification.subject,
        status: INBOUND_MAIL_STATUSES.received,
        // Résolu ici pour que le journal désigne le couple même si le
        // traitement échoue ; le worker le revérifie.
        rfq_supplier_id: token ? await this.recipientIdFor(token) : null,
        received_at: DateTime.fromISO(notification.receivedAt).toJSDate(),
        created_at: now,
        updated_at: now,
      })
      .onConflict(['provider', 'provider_message_id'])
      .ignore()
      .returning('id')

    if (inserted.length > 0) return { id: Number(inserted[0].id), created: true }

    const existing = await InboundMail.query()
      .where('provider', provider)
      .where('providerMessageId', notification.providerMessageId)
      .select('id')
      .firstOrFail()
    return { id: existing.id, created: false }
  }

  private async recipientIdFor(token: string): Promise<number | null> {
    const recipient = await RfqSupplier.query().where('replyToken', token).select('id').first()
    return recipient?.id ?? null
  }

  /**
   * Prend le mail (verrou `processing`), le traite, et le laisse `processed`,
   * `rejected` ou — sur erreur, relancée pour que le job soit rejoué — `failed`.
   */
  private async handle(
    inboundMailId: number,
    loadContent: (mail: InboundMail) => Promise<InboundMailContent>,
    attachmentLoaderFor: (mail: InboundMail) => AttachmentLoader
  ): Promise<void> {
    if (!(await this.claim(inboundMailId))) return

    const mail = await InboundMail.find(inboundMailId)
    if (!mail) throw new InboundMailNotFoundException(inboundMailId)

    try {
      const content = await loadContent(mail)
      const recipient = await this.resolveRecipient(mail)
      const rejection = this.rejectionFor(mail, content, recipient)

      mail.merge({
        headers: content.headers,
        sizeBytes: content.sizeBytes,
        rfqSupplierId: recipient?.id ?? null,
        error: null,
        processedAt: DateTime.now(),
      })

      if (rejection || !recipient) {
        // Un mail écarté n'est que journalisé : ni corps, ni pièces jointes.
        await mail
          .merge({ status: INBOUND_MAIL_STATUSES.rejected, rejectionReason: rejection })
          .save()
        logger.info({ inboundMailId, rejection }, 'inbound mail rejected')
        return
      }

      await this.storeAttachments(mail, content.attachments, attachmentLoaderFor(mail))
      await mail
        .merge({
          textBody: content.text,
          htmlBody: content.html,
          senderKnown: await this.isKnownSender(mail.senderAddress, recipient),
          status: INBOUND_MAIL_STATUSES.processed,
          rejectionReason: null,
        })
        .save()

      await emitter.emit(
        InboundMailReceived,
        new InboundMailReceived({ inboundMailId: mail.id, rfqSupplierId: recipient.id })
      )
    } catch (error) {
      await InboundMail.query()
        .where('id', inboundMailId)
        .update({ status: INBOUND_MAIL_STATUSES.failed, error: (error as Error).message })
      throw error
    }
  }

  /**
   * Bascule conditionnelle vers `processing` : deux jobs concurrents pour le
   * même mail (webhook relancé) n'en traitent qu'un. Un mail déjà traité ou
   * écarté n'est jamais repris.
   */
  private async claim(inboundMailId: number): Promise<boolean> {
    const claimed = await InboundMail.query()
      .where('id', inboundMailId)
      .whereIn('status', [INBOUND_MAIL_STATUSES.received, INBOUND_MAIL_STATUSES.failed])
      .update({ status: INBOUND_MAIL_STATUSES.processing })
    return Number(claimed[0] ?? claimed) > 0
  }

  private async resolveRecipient(mail: InboundMail): Promise<RfqSupplier | null> {
    const token = mail.recipient ? this.addresses.tokenFrom([mail.recipient]) : null
    if (!token) return null
    return RfqSupplier.query().where('replyToken', token).preload('rfq').first()
  }

  /**
   * Garde-fous, du moins coûteux au plus spécifique. Les boucles et les
   * réponses automatiques passent avant l'adresse : un avis de non-remise vers
   * une adresse inconnue reste d'abord une réponse automatique.
   */
  private rejectionFor(
    mail: InboundMail,
    content: InboundMailContent,
    recipient: RfqSupplier | null
  ): InboundMailRejection | null {
    const attachmentsSize = content.attachments.reduce((sum, a) => sum + (a.sizeBytes ?? 0), 0)
    if ((content.sizeBytes ?? attachmentsSize) > inboundMailConfig.maxSizeBytes) {
      return INBOUND_MAIL_REJECTIONS.tooLarge
    }

    const ownAddress = env.get('MAIL_FROM_ADDRESS').toLowerCase()
    if (mail.senderAddress === ownAddress || this.addresses.isRelayAddress(mail.senderAddress)) {
      return INBOUND_MAIL_REJECTIONS.loop
    }

    if (isAutomaticReply(content.headers, mail.senderAddress)) {
      return INBOUND_MAIL_REJECTIONS.autoReply
    }

    if (!recipient) return INBOUND_MAIL_REJECTIONS.unknownAddress
    if (this.addresses.isExpired(recipient.rfq)) return INBOUND_MAIL_REJECTIONS.expiredAddress
    return null
  }

  /**
   * Journalise chaque pièce jointe et copie sur Cellar celles qui sont
   * acceptées. Une pièce refusée n'écarte pas le mail. Rejouable : une pièce
   * déjà journalisée est laissée telle quelle.
   */
  private async storeAttachments(
    mail: InboundMail,
    attachments: InboundAttachmentDescriptor[],
    load: AttachmentLoader
  ): Promise<void> {
    const known = await InboundMailAttachment.query()
      .where('inboundMailId', mail.id)
      .select('providerAttachmentId')
    const done = new Set(known.map((row) => row.providerAttachmentId))

    for (const attachment of attachments) {
      if (done.has(attachment.id)) continue

      const mimeType = acceptedAttachmentType(attachment.filename)
      const refusal = this.refusalFor(attachment, mimeType)
      if (refusal || !mimeType) {
        await this.recordAttachment(mail, attachment, refusal ?? 'rejected_type', null, null)
        continue
      }

      const content = await load(attachment)
      if (content.length > inboundMailConfig.maxAttachmentSizeBytes) {
        await this.recordAttachment(
          mail,
          { ...attachment, sizeBytes: content.length },
          INBOUND_ATTACHMENT_STATUSES.rejectedSize,
          null,
          null
        )
        continue
      }

      const object = await this.storage.storeContent(
        content,
        fileExtension(attachment.filename),
        mimeType
      )
      try {
        await this.recordAttachment(
          mail,
          { ...attachment, sizeBytes: content.length },
          INBOUND_ATTACHMENT_STATUSES.stored,
          object.id,
          mimeType
        )
      } catch (error) {
        // Zéro orphelin : la référence n'a pas été écrite, l'objet est libéré.
        await this.storage.discard([object.id])
        throw error
      }
    }
  }

  private refusalFor(
    attachment: InboundAttachmentDescriptor,
    mimeType: string | null
  ): InboundAttachmentStatus | null {
    if (attachment.inline) return INBOUND_ATTACHMENT_STATUSES.ignoredInline
    if (!mimeType) return INBOUND_ATTACHMENT_STATUSES.rejectedType
    if ((attachment.sizeBytes ?? 0) > inboundMailConfig.maxAttachmentSizeBytes) {
      return INBOUND_ATTACHMENT_STATUSES.rejectedSize
    }
    return null
  }

  private async recordAttachment(
    mail: InboundMail,
    attachment: InboundAttachmentDescriptor,
    status: InboundAttachmentStatus,
    storageObjectId: number | null,
    mimeType: string | null
  ): Promise<void> {
    await InboundMailAttachment.create({
      inboundMailId: mail.id,
      providerAttachmentId: attachment.id,
      storageObjectId,
      filename: attachment.filename.slice(0, 255),
      mimeType: mimeType ?? attachment.contentType?.slice(0, 150) ?? null,
      sizeBytes: attachment.sizeBytes,
      status,
    })
  }

  /**
   * L'expéditeur est-il l'adresse de contact du fournisseur ou celle d'un de
   * ses membres ? Indicatif (affiché à l'équipe et à l'agence) : un fournisseur
   * répond souvent depuis une autre boîte, ce n'est pas un motif de rejet.
   */
  private async isKnownSender(senderAddress: string, recipient: RfqSupplier): Promise<boolean> {
    await recipient.load('supplierOrganization')
    if (recipient.supplierOrganization.email?.toLowerCase() === senderAddress) return true

    const member = await OrganizationUser.query()
      .where('organizationId', recipient.supplierOrganizationId)
      .whereHas('user', (user) => user.whereRaw('lower(email) = ?', [senderAddress]))
      .first()
    return member !== null
  }
}
