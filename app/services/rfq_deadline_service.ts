import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Rfq from '#models/rfq'
import RfqRecipientService from '#services/rfq_recipient_service'
import {
  RfqInvalidDeadlineException,
  RfqNotExpirableException,
  RfqNotExtendableException,
} from '#exceptions/rfq_errors'
import { parseRfqDeadline, startOfDeadlineDay } from '#shared/helpers/rfq_deadline'
import type { ExtendRfqDeadlineData } from '#shared/types/rfq'

/**
 * Échéance d'une demande de devis (#56, #232) : expiration à la date, et
 * prolongation qui rouvre une demande échue.
 *
 * ```
 * published ──expire (échéance dépassée)──▶ expired
 *     ▲                                        │
 *     └──────────── extendDeadline ────────────┘
 * ```
 *
 * La demande et ses destinataires basculent ensemble, dans une transaction :
 * les destinataires sans réponse passent `expired` et retrouvent leur statut à
 * la réouverture (`RfqRecipientService`).
 */
@inject()
export default class RfqDeadlineService {
  constructor(private recipients: RfqRecipientService) {}

  /**
   * Bascule une demande publiée en `expired`. Les destinataires restés sans
   * réponse passent `expired` (#232) ; ceux qui ont répondu ou décliné gardent
   * leur statut.
   */
  async expire(
    rfq: Rfq,
    now: DateTime = DateTime.now(),
    client?: TransactionClientContract
  ): Promise<Rfq> {
    return this.switchToExpired(rfq, now, { onlyIfDue: false, client })
  }

  /**
   * Fait expirer toutes les demandes publiées dont l'échéance est dépassée.
   * Appelé par `ExpireRfqsJob` ; renvoie les demandes **effectivement** basculées.
   *
   * L'échéance est une **date** : la demande est échue le lendemain à 00:00,
   * heure de Paris (`RFQ_DEADLINE_TIMEZONE`). Un brouillon, une demande close
   * ou sans échéance n'expirent jamais.
   *
   * Chaque bascule est conditionnelle (statut et échéance revérifiés en base) :
   * une demande close ou prolongée entre la lecture et l'écriture est laissée
   * telle quelle. Un échec isolé est loggué sans interrompre le lot : chaque
   * demande a sa propre transaction, indépendante des autres.
   */
  async expireDue(now: DateTime = DateTime.now()): Promise<Rfq[]> {
    const due = await Rfq.query()
      .where('status', 'published')
      .whereNotNull('deadline')
      .where('deadline', '<', startOfDeadlineDay(now).toSQL()!)

    const outcomes = await Promise.all(due.map((rfq) => this.tryExpireDue(rfq, now)))
    return outcomes.filter((rfq): rfq is Rfq => rfq !== null)
  }

  /**
   * Prolonge l'échéance d'une demande publiée ou échue — et **seulement**
   * l'échéance. Sur une demande échue, la nouvelle date la rouvre : elle
   * repasse `published`, ses destinataires expirés retrouvent leur statut et
   * les fournisseurs peuvent répondre de nouveau.
   *
   * « Prolonger » ne raccourcit jamais : la nouvelle date ne peut être ni passée
   * ni antérieure ou égale à l'échéance actuelle.
   */
  async extendDeadline(
    rfq: Rfq,
    data: ExtendRfqDeadlineData,
    now: DateTime = DateTime.now()
  ): Promise<Rfq> {
    if (rfq.status !== 'published' && rfq.status !== 'expired') {
      throw new RfqNotExtendableException()
    }
    const deadline = this.validNewDeadline(rfq, data.deadline, now)

    const wasExpired = rfq.status === 'expired'
    await db.transaction(async (trx) => {
      rfq.useTransaction(trx)
      rfq.merge({
        deadline,
        ...(wasExpired ? { status: 'published' as const, expiredAt: null } : {}),
      })
      await rfq.save()
      if (wasExpired) await this.recipients.restoreExpired(rfq.id, now, trx)
      await this.recipients.resetReminders(rfq.id, trx)
    })
    return rfq
  }

  /** Nouvelle échéance lue et validée : ni passée, ni pas plus tard que l'actuelle. */
  private validNewDeadline(rfq: Rfq, value: string, now: DateTime): DateTime {
    const deadline = parseRfqDeadline(value)
    const isValid =
      deadline !== null &&
      deadline >= startOfDeadlineDay(now) &&
      (!rfq.deadline || deadline > rfq.deadline)
    if (!isValid) throw new RfqInvalidDeadlineException()
    return deadline
  }

  /** Une demande du lot : `null` si elle n'était plus à expirer ou a échoué. */
  private async tryExpireDue(rfq: Rfq, now: DateTime): Promise<Rfq | null> {
    try {
      return await this.switchToExpired(rfq, now, { onlyIfDue: true })
    } catch (error) {
      if (!(error instanceof RfqNotExpirableException)) {
        logger.error({ err: error, rfqId: rfq.id }, 'failed to expire rfq')
      }
      return null
    }
  }

  /**
   * `UPDATE … WHERE status = 'published'` (et échéance dépassée si `onlyIfDue`) :
   * la garde est en base, pas sur l'instance chargée, donc une transition
   * concurrente n'est jamais écrasée. La demande et ses destinataires basculent
   * dans la même transaction — celle de l'appelant si fournie.
   */
  private async switchToExpired(
    rfq: Rfq,
    now: DateTime,
    { onlyIfDue, client }: { onlyIfDue: boolean; client?: TransactionClientContract }
  ): Promise<Rfq> {
    const run = async (trx: TransactionClientContract) => {
      const query = Rfq.query({ client: trx }).where('id', rfq.id).where('status', 'published')
      if (onlyIfDue) query.where('deadline', '<', startOfDeadlineDay(now).toSQL()!)

      const [updated] = await query.update({ status: 'expired', expiredAt: now.toJSDate() })
      if (!Number(updated)) throw new RfqNotExpirableException()
      await this.recipients.expireAwaiting(rfq.id, now, trx)
    }
    await (client ? run(client) : db.transaction(run))

    await rfq.refresh()
    return rfq
  }
}
