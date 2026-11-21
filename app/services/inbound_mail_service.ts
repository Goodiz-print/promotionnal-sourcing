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
import SupplierProfile from '#models/supplier_profile'
import InboundAddressService from '#services/inbound_address_service'
import InboundMailProvider from '#services/inbound_mail/inbound_mail_provider'
import StorageService from '#services/storage/storage_service'
import {
  acceptedAttachmentType,
  fileExtension,
  isAutomaticReply,
  matchesFileSignature,
  parseMailAddress,
  RELAY_TOKEN_FIELDS,
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
  type RelayTarget,
  type ResolvedInboundRecipient,
} from '#shared/types/inbound_mail'

/** Longueurs des colonnes de `inbound_mails` : une valeur trop longue est tronquée. */
const ADDRESS_MAX = 320
const NAME_MAX = 255

/**
 * Date de réception annoncée par le prestataire. Resend écrit ses dates en ISO
 * (`2026-02-22T23:41:11Z`) ou à la façon de PostgreSQL (`2026-02-22 23:41:11+00`)
 * selon l'appel ; une date illisible ne doit pas empêcher de journaliser le mail.
 */
function receivedDate(value: string): Date {
  const iso = DateTime.fromISO(value, { setZone: true })
  if (iso.isValid) return iso.toJSDate()
  const sql = DateTime.fromSQL(value, { setZone: true })
  return sql.isValid ? sql.toJSDate() : new Date()
}

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
 * Ce service s'arrête là : l'enregistrer comme message et comme devis
 * (`SupplierReplyService`, #224) ou la transmettre à l'agence (#225) est
 * l'affaire des écouteurs de l'événement.
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
    const target = this.addresses.targetFrom(notification.recipients)
    // L'adresse relais, où qu'elle soit parmi les destinataires et quelle que
    // soit sa forme (`Nom <adresse>`) : le traitement relit cette colonne.
    const recipient =
      notification.recipients.find((address) => this.addresses.isRelayAddress(address)) ??
      notification.recipients[0]
    const now = new Date()

    const inserted = await db
      .table(InboundMail.table)
      .insert({
        provider,
        provider_message_id: notification.providerMessageId,
        message_id: notification.messageId,
        recipient: recipient ? parseMailAddress(recipient).address.slice(0, ADDRESS_MAX) : null,
        sender_address: sender.address.slice(0, ADDRESS_MAX),
        sender_name: sender.name?.slice(0, NAME_MAX) ?? null,
        subject: notification.subject,
        status: INBOUND_MAIL_STATUSES.received,
        // Résolu ici pour que le journal désigne le couple même si le
        // traitement échoue ; le worker le revérifie.
        rfq_supplier_id: target ? await this.recipientIdFor(target) : null,
        received_at: receivedDate(notification.receivedAt),
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

  private async recipientIdFor(target: RelayTarget): Promise<number | null> {
    const recipient = await this.recipientQuery(target).select('id').first()
    return recipient?.id ?? null
  }

  /**
   * Couple désigné par une adresse relais : par le jeton **du côté qui écrit**
   * (#226). Une adresse `agency-` ne se résout jamais par `reply_token`.
   */
  private recipientQuery(target: RelayTarget) {
    return RfqSupplier.query().where(RELAY_TOKEN_FIELDS[target.side], target.token)
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
    const claimed = await this.claim(inboundMailId)
    if (!claimed) return

    const mail = await InboundMail.find(inboundMailId)
    if (!mail) throw new InboundMailNotFoundException(inboundMailId)

    try {
      const content = await loadContent(mail)
      const resolved = await this.resolveRecipient(mail)
      const recipient = resolved?.recipient ?? null
      const rejection = this.rejectionFor(mail, content, recipient)

      mail.merge({
        headers: content.headers,
        sizeBytes: content.sizeBytes,
        rfqSupplierId: recipient?.id ?? null,
        error: null,
        processedAt: DateTime.now(),
      })

      if (rejection || !resolved) {
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
          senderKnown: await this.isKnownSender(mail.senderAddress, resolved),
          status: INBOUND_MAIL_STATUSES.processed,
          rejectionReason: null,
        })
        .save()

      await emitter.emit(
        InboundMailReceived,
        new InboundMailReceived({
          inboundMailId: mail.id,
          rfqSupplierId: resolved.recipient.id,
          side: resolved.side,
        })
      )
    } catch (error) {
      await InboundMail.query()
        .where('id', inboundMailId)
        .update({
          status: INBOUND_MAIL_STATUSES.failed,
          error: (error as Error).message,
          updated_at: new Date(),
        })
      throw error
    }
  }

  /**
   * Bascule conditionnelle vers `processing` : deux jobs concurrents pour le
   * même mail (webhook relancé) n'en traitent qu'un. Un mail déjà traité ou
   * écarté n'est jamais repris. Un verrou `processing` resté posé au-delà de
   * `staleAfterMinutes` est celui d'un worker tué en plein traitement : il est
   * repris.
   */
  private async claim(inboundMailId: number): Promise<boolean> {
    const claimed = await InboundMail.query()
      .where('id', inboundMailId)
      .where((open) => {
        open
          .whereIn('status', [INBOUND_MAIL_STATUSES.received, INBOUND_MAIL_STATUSES.failed])
          .orWhere((stale) => {
            stale
              .where('status', INBOUND_MAIL_STATUSES.processing)
              .where('updated_at', '<', this.staleBefore())
          })
      })
      .update({ status: INBOUND_MAIL_STATUSES.processing, updated_at: new Date() })
    return Number(claimed[0] ?? claimed) > 0
  }

  private staleBefore(): Date {
    return DateTime.now().minus({ minutes: inboundMailConfig.staleAfterMinutes }).toJSDate()
  }

  /**
   * Reprise planifiée (`RecoverInboundMailsJob`) : remet en file les mails qui
   * n'ont pas abouti et que plus rien ne rejouera — verrou `processing`
   * abandonné, tentatives du job épuisées (`failed`), mise en file perdue
   * (`received`). Le prestataire, lui, ne relance pas : le webhook a répondu 200.
   *
   * Seuls les mails au repos depuis `staleAfterMinutes` sont repris (le job en
   * cours a encore ses propres tentatives), et seulement pendant
   * `recoveryWindowHours` après réception : au-delà, la ligne reste `failed`
   * pour la supervision.
   */
  async recoverStale(): Promise<number> {
    const stale = await InboundMail.query()
      .whereIn('status', [
        INBOUND_MAIL_STATUSES.received,
        INBOUND_MAIL_STATUSES.processing,
        INBOUND_MAIL_STATUSES.failed,
      ])
      .where('updated_at', '<', this.staleBefore())
      .where(
        'received_at',
        '>',
        DateTime.now().minus({ hours: inboundMailConfig.recoveryWindowHours }).toJSDate()
      )
      .select('id')
      .orderBy('id')

    for (const mail of stale) await ProcessInboundMailJob.dispatch({ inboundMailId: mail.id })
    return stale.length
  }

  /**
   * Couple visé et côté qui écrit (#226) : le couple qu'un admin a choisi
   * (rattachement manuel, #227), sinon celui que désigne le jeton de l'adresse
   * relais. Le côté suit le préfixe de l'adresse (`rfq-` : le fournisseur,
   * `agency-` : l'agence) ; un mail rattaché à la main vers une adresse
   * inconnue vaut une réponse du fournisseur.
   */
  private async resolveRecipient(
    mail: InboundMail
  ): Promise<ResolvedInboundRecipient<RfqSupplier> | null> {
    const side = this.addresses.sideOf(mail.recipient)
    if (mail.attachedManuallyAt && mail.rfqSupplierId) {
      const attached = await RfqSupplier.query()
        .where('id', mail.rfqSupplierId)
        .preload('rfq')
        .first()
      return attached ? { recipient: attached, side } : null
    }

    const target = mail.recipient ? this.addresses.targetFrom([mail.recipient]) : null
    if (!target) return null
    const recipient = await this.recipientQuery(target).preload('rfq').first()
    return recipient ? { recipient, side: target.side } : null
  }

  /**
   * Garde-fous, du moins coûteux au plus spécifique. Les boucles et les
   * réponses automatiques passent avant l'adresse : un avis de non-remise vers
   * une adresse inconnue reste d'abord une réponse automatique.
   *
   * Un mail rattaché à la main par un admin (#227) n'est plus écarté que s'il
   * est trop gros ou forme une boucle : l'admin a jugé que c'est une réponse,
   * même vers une adresse expirée ou détectée à tort comme automatique.
   */
  private rejectionFor(
    mail: InboundMail,
    content: InboundMailContent,
    recipient: RfqSupplier | null
  ): InboundMailRejection | null {
    if (this.isTooLarge(content)) return INBOUND_MAIL_REJECTIONS.tooLarge
    if (this.isLoop(mail)) return INBOUND_MAIL_REJECTIONS.loop
    if (mail.attachedManuallyAt) return recipient ? null : INBOUND_MAIL_REJECTIONS.unknownAddress

    if (isAutomaticReply(content.headers, mail.senderAddress)) {
      return INBOUND_MAIL_REJECTIONS.autoReply
    }

    if (!recipient) return INBOUND_MAIL_REJECTIONS.unknownAddress
    if (this.addresses.isExpired(recipient.rfq)) return INBOUND_MAIL_REJECTIONS.expiredAddress
    return null
  }

  private isTooLarge(content: InboundMailContent): boolean {
    const attachmentsSize = content.attachments.reduce((sum, a) => sum + (a.sizeBytes ?? 0), 0)
    return (content.sizeBytes ?? attachmentsSize) > inboundMailConfig.maxSizeBytes
  }

  /** Mail envoyé par la plateforme elle-même, ou depuis une adresse relais. */
  private isLoop(mail: InboundMail): boolean {
    const ownAddress = env.get('MAIL_FROM_ADDRESS').toLowerCase()
    return mail.senderAddress === ownAddress || this.addresses.isRelayAddress(mail.senderAddress)
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

      // L'extension ne prouve rien : le contenu doit être du format annoncé.
      if (!matchesFileSignature(fileExtension(attachment.filename), content)) {
        await this.recordAttachment(
          mail,
          { ...attachment, sizeBytes: content.length },
          INBOUND_ATTACHMENT_STATUSES.rejectedType,
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
   * L'expéditeur est-il connu du côté qui écrit ? Côté fournisseur : son
   * adresse de réception (#217) ou de contact, ou celle d'un de ses membres.
   * Côté agence (#226) : l'adresse d'un membre de l'agence. Indicatif (affiché
   * à l'équipe) : on répond souvent depuis une autre boîte, ce n'est pas un
   * motif de rejet.
   */
  private async isKnownSender(
    senderAddress: string,
    { recipient, side }: ResolvedInboundRecipient<RfqSupplier>
  ): Promise<boolean> {
    if (side === 'agency') {
      return this.isMemberAddress(senderAddress, recipient.rfq.buyerOrganizationId)
    }
    if (await this.isDeclaredAddress(senderAddress, recipient)) return true
    return this.isMemberAddress(senderAddress, recipient.supplierOrganizationId)
  }

  private async isMemberAddress(senderAddress: string, organizationId: number): Promise<boolean> {
    const member = await OrganizationUser.query()
      .where('organizationId', organizationId)
      .whereHas('user', (user) => user.whereRaw('lower(email) = ?', [senderAddress]))
      .select('id')
      .first()
    return member !== null
  }

  /** Adresse de réception du profil ou de contact de l'organisation. */
  private async isDeclaredAddress(senderAddress: string, recipient: RfqSupplier) {
    await recipient.load('supplierOrganization')
    const profile = await SupplierProfile.query()
      .select('id', 'quoteEmail')
      .where('organizationId', recipient.supplierOrganizationId)
      .first()
    const declared = [profile?.quoteEmail, recipient.supplierOrganization.email]
    return declared.some((email) => email?.trim().toLowerCase() === senderAddress)
  }
}
