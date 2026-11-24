import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import RfqSupplier from '#models/rfq_supplier'
import type Rfq from '#models/rfq'
import { RfqNotEditableException, RfqSupplierNotFoundException } from '#exceptions/rfq_errors'
import {
  AWAITING_REPLY_RFQ_SUPPLIER_STATUSES,
  MAIL_REPLYABLE_RFQ_SUPPLIER_STATUSES,
  RFQ_REMINDER_AFTER_DAYS,
  TERMINAL_RFQ_SUPPLIER_STATUSES,
} from '#shared/types/rfq'
import { acceptsResponses, isLateReply, startOfDeadlineDay } from '#shared/helpers/rfq_deadline'

/**
 * Avancement d'une demande **pour chaque destinataire** (`rfq_suppliers`) :
 *
 * ```
 * pending ──send──▶ sent ──ouverture──▶ viewed
 *                    │                    │
 *                    ├──── decline ───────┼──▶ declined
 *                    ├──── devis ─────────┼──▶ responded (tardive si après l'échéance)
 *                    └──── échéance ──────┴──▶ expired ──réouverture──▶ sent / viewed
 * ```
 *
 * Et la relance de ceux qui n'ont pas répondu (#232). `pending` → `sent` reste
 * dans `RfqService#send` : c'est la diffusion de la demande. L'expiration et la
 * réouverture sont pilotées par `RfqDeadlineService`, qui délègue ici la bascule
 * des destinataires.
 *
 * Les gardes de statut sont en base (`UPDATE … WHERE status IN (…)`) dès
 * qu'une transition concurrente est possible.
 */
export default class RfqRecipientService {
  /**
   * Accusé de lecture côté fournisseur : `sent` → `viewed`. Idempotent, et
   * jamais régressif — une demande déjà `responded`/`declined`/`expired` ne
   * redevient pas « simplement consultée » parce que le fournisseur rouvre l'écran.
   */
  async markViewed(rfq: Rfq, supplierOrganizationId: number): Promise<RfqSupplier> {
    return this.applyViewed(await this.findRecipient(rfq, supplierOrganizationId))
  }

  /**
   * Accusé de lecture appliqué à une ligne déjà chargée — `RfqService#openForSupplier`
   * bascule ainsi l'instance **préchargée**, que l'écran va transformer.
   */
  async applyViewed(target: RfqSupplier): Promise<RfqSupplier> {
    if (target.status === 'sent') {
      target.status = 'viewed'
      await target.save()
    }
    return target
  }

  /**
   * Le fournisseur a déposé un devis depuis la plateforme : `sent`/`viewed` →
   * `responded`.
   */
  async markResponded(rfq: Rfq, supplierOrganizationId: number): Promise<RfqSupplier> {
    return this.transitionRecipient(rfq, supplierOrganizationId, 'responded')
  }

  /** Le fournisseur décline la consultation : `sent`/`viewed` → `declined`. */
  async decline(rfq: Rfq, supplierOrganizationId: number): Promise<RfqSupplier> {
    return this.transitionRecipient(rfq, supplierOrganizationId, 'declined')
  }

  /**
   * Le fournisseur a répondu avec son devis en PDF, par mail (#224) ou déposé
   * depuis l'écran de la demande (#230) :
   * `sent`/`viewed` → `responded`, dans la transaction qui enregistre la
   * réponse. Une réponse **tardive** (#232) est acceptée aussi, y compris d'un
   * destinataire `expired`. Sans effet (`false`) si la demande est close ou si
   * le destinataire a déjà répondu ou décliné — la garde est en base.
   * `recipient.rfq` doit être chargée.
   */
  async markRespondedWithQuote(
    recipient: RfqSupplier,
    trx: TransactionClientContract
  ): Promise<boolean> {
    const { status } = recipient.rfq
    if (status !== 'published' && status !== 'expired') return false

    const [updated] = await RfqSupplier.query({ client: trx })
      .where('id', recipient.id)
      .whereIn('status', [...MAIL_REPLYABLE_RFQ_SUPPLIER_STATUSES])
      .update({ status: 'responded', expiredFrom: null, updatedAt: DateTime.now().toJSDate() })
    return Number(updated) > 0
  }

  /**
   * Une réponse **reçue** à `receivedAt` est-elle tardive (#232) ? C'est
   * l'heure de réception qui compte, pas celle du traitement (mail repris
   * après minuit, rejeu admin) — cf. `isLateReply`. Si oui, la première est
   * datée sur le destinataire (`late_reply_at`, heure de réception), que les
   * écrans signalent. Renvoie `true` pour toute réponse tardive, la première
   * comme les suivantes. `recipient.rfq` doit être chargée.
   */
  async markLateReply(
    recipient: RfqSupplier,
    trx: TransactionClientContract,
    receivedAt: DateTime = DateTime.now()
  ): Promise<boolean> {
    if (!isLateReply(recipient.rfq, startOfDeadlineDay(receivedAt))) return false

    await RfqSupplier.query({ client: trx })
      .where('id', recipient.id)
      .whereNull('lateReplyAt')
      .update({ lateReplyAt: receivedAt.toJSDate() })
    return true
  }

  /**
   * Destinataires sans réponse d'une demande qui expire : `sent` / `viewed` →
   * `expired`, l'ancien statut gardé dans `expired_from` pour une réouverture.
   */
  async expireAwaiting(
    rfqId: number,
    now: DateTime,
    trx: TransactionClientContract
  ): Promise<void> {
    await RfqSupplier.query({ client: trx })
      .where('rfqId', rfqId)
      .whereIn('status', [...AWAITING_REPLY_RFQ_SUPPLIER_STATUSES])
      .update({ status: 'expired', expiredFrom: db.raw('status'), updatedAt: now.toJSDate() })
  }

  /**
   * Réouverture d'une demande échue : chaque destinataire expiré retrouve le
   * statut qu'il avait avant l'échéance (à défaut `sent`).
   */
  async restoreExpired(
    rfqId: number,
    now: DateTime,
    trx: TransactionClientContract
  ): Promise<void> {
    await RfqSupplier.query({ client: trx })
      .where('rfqId', rfqId)
      .where('status', 'expired')
      .update({
        status: db.raw("COALESCE(expired_from, 'sent')"),
        expiredFrom: null,
        updatedAt: now.toJSDate(),
      })
  }

  /**
   * Destinataires à relancer (#232) : sans réponse (`remindableRecipients`)
   * depuis au moins `RFQ_REMINDER_AFTER_DAYS` jours après l'envoi. Ouvrir la
   * demande ne compte pas : seul un message du fournisseur ou une décision
   * l'écarte. La demande doit encore être ouverte : publiée et non échue —
   * relancer pour une échéance passée serait absurde. Préchargés : `rfq` (avec
   * l'acheteur) et `supplierOrganization`, ce dont
   * `RfqNotificationService#remind` a besoin.
   */
  dueForReminder(now: DateTime = DateTime.now()): Promise<RfqSupplier[]> {
    const sentBefore = now.minus({ days: RFQ_REMINDER_AFTER_DAYS })
    const today = startOfDeadlineDay(now)

    return this.remindableRecipients()
      .where('sentAt', '<=', sentBefore.toSQL()!)
      .whereHas('rfq', (rfq) =>
        rfq
          .where('status', 'published')
          .where((open) => open.whereNull('deadline').orWhere('deadline', '>=', today.toSQL()!))
      )
      .preload('rfq', (rfq) => rfq.preload('buyerOrganization'))
      .preload('supplierOrganization')
      .orderBy('id')
  }

  /**
   * Destinataires qu'on peut relancer (#232) : sans réponse — `sent` ou
   * `viewed`, et aucun message de leur part dans le fil (une réponse par mail
   * sans devis ne change pas le statut) — et jamais relancés. Prédicat unique :
   * la relance planifiée, l'intervention manuelle et le compteur de la fiche
   * admin lisent la même requête. Restreint à une demande si `rfqId` est fourni.
   */
  remindableRecipients(rfqId?: number, client?: TransactionClientContract) {
    const query = this.awaitingReply(client).whereNull('remindedAt')
    if (rfqId !== undefined) query.where('rfqId', rfqId)
    return query
  }

  /**
   * Consigne la relance des destinataires : c'est ce qui la rend unique. Une seule
   * requête, pour réduire la fenêtre entre « mails en queue » et « relance
   * consignée ».
   */
  async markReminded(
    recipients: RfqSupplier[],
    now: DateTime = DateTime.now(),
    client?: TransactionClientContract
  ): Promise<void> {
    if (recipients.length === 0) return
    await RfqSupplier.query({ client })
      .whereIn(
        'id',
        recipients.map(({ id }) => id)
      )
      .update({ remindedAt: now.toJSDate() })
  }

  /**
   * Nouvelle échéance, nouvelle chance : les destinataires toujours sans réponse
   * d'une demande peuvent être relancés une fois de plus.
   */
  async resetReminders(rfqId: number, trx: TransactionClientContract): Promise<void> {
    await this.awaitingReply(trx).where('rfqId', rfqId).update({ remindedAt: null })
  }

  /**
   * Destinataires qui n'ont **pas répondu** : statut `sent` / `viewed` et aucun
   * message écrit côté fournisseur dans le fil de la demande. Un message masqué
   * par la modération compte quand même : le fournisseur a bien répondu, le
   * relancer serait faux (et le relancer après un avertissement, maladroit).
   */
  private awaitingReply(client?: TransactionClientContract) {
    return RfqSupplier.query({ client })
      .whereIn('status', [...AWAITING_REPLY_RFQ_SUPPLIER_STATUSES])
      .whereNotExists((replies) =>
        replies
          .from('messages')
          .join('conversations', 'conversations.id', 'messages.conversation_id')
          .whereColumn('conversations.rfq_supplier_id', 'rfq_suppliers.id')
          .where('messages.sender_side', 'supplier')
      )
  }

  /**
   * Transition vers un statut terminal côté fournisseur. Refusée si la demande
   * n'attend plus de réponse, si elle n'a pas été reçue (`pending`) ou si une
   * décision a déjà été prise.
   */
  private async transitionRecipient(
    rfq: Rfq,
    supplierOrganizationId: number,
    status: 'responded' | 'declined'
  ): Promise<RfqSupplier> {
    if (!acceptsResponses(rfq)) throw new RfqNotEditableException()

    const target = await this.findRecipient(rfq, supplierOrganizationId)

    if (target.status === 'pending' || TERMINAL_RFQ_SUPPLIER_STATUSES.includes(target.status)) {
      throw new RfqNotEditableException()
    }

    target.status = status
    await target.save()
    return target
  }

  private async findRecipient(rfq: Rfq, supplierOrganizationId: number): Promise<RfqSupplier> {
    const target = await RfqSupplier.query()
      .where('rfqId', rfq.id)
      .where('supplierOrganizationId', supplierOrganizationId)
      .first()

    if (!target) throw new RfqSupplierNotFoundException()
    return target
  }
}
