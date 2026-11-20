import { inject } from '@adonisjs/core'
import { urlFor } from '@adonisjs/core/services/url_builder'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import OrganizationUser from '#models/organization_user'
import SupplierProfile from '#models/supplier_profile'
import SendMailJob from '#jobs/send_mail_job'
import InboundAddressService from '#services/inbound_address_service'
import { mailIdempotencyKey } from '#shared/helpers/mail'
import { MAIL_KINDS, type SendMailContent, type SendMailPayload } from '#shared/types/mail'
import { RFQ_DEADLINE_TIMEZONE, RFQ_RESPONDER_ROLES, type RfqMailAddress } from '#shared/types/rfq'
import { resolveQuoteAddresses } from '#shared/helpers/quote_address'
import type Organization from '#models/organization'
import type Rfq from '#models/rfq'
import type { Locale } from '#shared/types/i18n'
import type RfqSupplier from '#models/rfq_supplier'

/** Les mails de demande de devis envoyés aux fournisseurs. */
type QueuedKind = typeof MAIL_KINDS.rfqReceived | typeof MAIL_KINDS.rfqReminder

/**
 * Notification des destinataires d'une demande de devis, au moment où
 * l'acheteur la diffuse (`RfqService#send`).
 *
 * Séparé de `RfqService` volontairement : le service porte la machine à états,
 * qui doit rester testable sans queue ni SMTP. Ici on ne fait que traduire
 * « ces destinataires viennent de passer en `sent` » en mails mis en queue.
 *
 * Pas de risque de relance en boucle : `send()` ne bascule que les `pending`,
 * et ne renvoie que les lignes réellement basculées. Un second clic sur
 * « envoyer » est refusé par la machine à états, pas rattrapé ici.
 */
@inject()
export default class RfqNotificationService {
  constructor(private inboundAddresses: InboundAddressService) {}

  /**
   * Met en queue un mail par adresse destinataire, **dans la langue de chaque
   * destinataire** (lien, échéance et texte). Renvoie le nombre de mails mis en
   * queue — utile aux tests et aux logs, l'écran comptant les *organisations*
   * notifiées.
   *
   * Un échec de mise en queue (base indisponible) est **loggué sans être
   * propagé** : les statuts sont déjà basculés côté acheteur, et la demande
   * apparaît de toute façon dans l'écran « demandes reçues » du fournisseur —
   * faire échouer la requête laisserait un état incohérent pour un canal qui
   * n'est qu'un rappel.
   */
  async notifyRecipients(
    rfq: Rfq,
    buyer: Organization,
    recipients: RfqSupplier[]
  ): Promise<number> {
    if (recipients.length === 0) return 0

    const itemCount = await this.countItems(rfq)
    let queued = 0

    for (const recipient of recipients) {
      const { queued: count } = await this.queueMails(
        rfq,
        recipient,
        MAIL_KINDS.rfqReceived,
        'failed to queue rfq notification',
        ({ locale }) => ({
          buyerName: buyer.name,
          rfqTitle: rfq.title,
          itemCount,
          deadline:
            rfq.deadline?.setZone(RFQ_DEADLINE_TIMEZONE).setLocale(locale).toLocaleString() ?? null,
          rfqPath: urlFor('supplier.rfqs.show', { locale, id: rfq.id }),
        })
      )
      queued += count
    }

    return queued
  }

  /**
   * Relance les destinataires silencieux : **un seul** mail par adresse, dans sa
   * langue. Renvoie les lignes **entièrement** relancées — celles dont toutes
   * les adresses ont été mises en queue. L'appelant (`RemindRfqSuppliersJob`) les
   * consigne ensuite via `RfqService#markReminded`, ce qui rend la relance unique.
   *
   * Même politique d'échec que `notifyRecipients` : une mise en queue ratée est
   * loguée sans être propagée, et le destinataire, non consigné, est reconsidéré
   * au prochain passage — les adresses déjà parties ne sont pas redoublées
   * (clé d'idempotence). Suppose `rfq.buyerOrganization` et
   * `supplierOrganization` préchargés (cf. `RfqService#dueForReminder`).
   */
  async remind(recipients: RfqSupplier[]): Promise<RfqSupplier[]> {
    const reminded: RfqSupplier[] = []

    for (const recipient of recipients) {
      const { rfq } = recipient
      const { queued, total } = await this.queueMails(
        rfq,
        recipient,
        MAIL_KINDS.rfqReminder,
        'failed to queue rfq reminder',
        ({ locale }) => ({
          buyerName: rfq.buyerOrganization.name,
          rfqTitle: rfq.title,
          deadline:
            rfq.deadline?.setZone(RFQ_DEADLINE_TIMEZONE).setLocale(locale).toLocaleString() ?? null,
          rfqPath: urlFor('supplier.rfqs.show', { locale, id: rfq.id }),
        })
      )

      if (total > 0 && queued === total) reminded.push(recipient)
    }

    return reminded
  }

  /**
   * Met en queue le mail `kind` pour chaque adresse du destinataire, sans jamais
   * propager un échec. Renvoie le nombre d'adresses visées et mises en queue.
   *
   * Chaque mail porte en `Reply-To` l'adresse relais du couple demande /
   * fournisseur (#223) — la même pour toutes les adresses du fournisseur.
   */
  private async queueMails<K extends QueuedKind>(
    rfq: Rfq,
    recipient: RfqSupplier,
    kind: K,
    failureMessage: string,
    buildData: (
      address: RfqMailAddress
    ) => Omit<Extract<SendMailContent, { kind: K }>['data'], 'replyTo'>
  ): Promise<{ queued: number; total: number }> {
    const addresses = await this.addressesFor(recipient)
    const replyTo = await this.inboundAddresses.addressFor(recipient)
    let queued = 0

    for (const address of addresses) {
      try {
        await SendMailJob.dispatch({
          kind,
          idempotencyKey: mailIdempotencyKey(kind, {
            rfq: rfq.id,
            org: recipient.supplierOrganizationId,
            to: address.email,
          }),
          to: address.email,
          locale: address.locale,
          data: { ...buildData(address), replyTo },
        } as SendMailPayload)
        queued += 1
      } catch (error) {
        logger.warn(
          { err: error, rfqId: rfq.id, supplierOrganizationId: recipient.supplierOrganizationId },
          failureMessage
        )
      }
    }

    return { queued, total: addresses.length }
  }

  /**
   * Compté plutôt que lu sur `rfq.items` : le service ne suppose rien des
   * relations préchargées par l'appelant.
   */
  private async countItems(rfq: Rfq): Promise<number> {
    const [{ total }] = await db.from('rfq_items').where('rfq_id', rfq.id).count('* as total')
    return Number(total)
  }

  /**
   * Adresses à prévenir pour un destinataire, chacune avec sa langue.
   *
   * Ordre de résolution (#217, `resolveQuoteAddresses`) : l'adresse de
   * réception du profil fournisseur (`supplier_profiles.quote_email`), si elle
   * a été confirmée par lien, puis
   * l'adresse de contact de l'organisation, puis les membres qui peuvent
   * effectivement répondre (`RFQ_RESPONDER_ROLES`, mêmes rôles que
   * `canRespondToRfq`) — notifier un `member`, qui n'a pas accès à l'écran,
   * serait une impasse.
   *
   * Suppose `supplierOrganization` préchargé, ce que garantit
   * `RfqService#send` sur les lignes qu'il renvoie.
   */
  private async addressesFor(recipient: RfqSupplier): Promise<RfqMailAddress[]> {
    const organizationId = recipient.supplierOrganizationId
    const [memberships, profile] = await Promise.all([
      OrganizationUser.query()
        .where('organizationId', organizationId)
        .whereHas('role', (role) => role.whereIn('slug', [...RFQ_RESPONDER_ROLES]))
        .preload('user')
        .orderBy('joinedAt', 'asc'),
      SupplierProfile.query()
        .select('id', 'quoteEmail', 'quoteEmailVerifiedAt')
        .where('organizationId', organizationId)
        .first(),
    ])

    return resolveQuoteAddresses({
      quoteEmail: profile?.quoteEmail ?? null,
      quoteEmailVerified: Boolean(profile?.quoteEmailVerifiedAt),
      organizationEmail: recipient.supplierOrganization.email,
      members: memberships.map(({ user }) => ({
        email: user.email,
        locale: user.locale as Locale,
      })),
    })
  }
}
