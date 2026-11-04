import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AdminAuditService from '#services/admin_audit_service'
import QuoteService from '#services/quote_service'
import RfqNotificationService from '#services/rfq_notification_service'
import RfqService from '#services/rfq_service'
import Rfq from '#models/rfq'
import {
  AdminRfqNotRemindableException,
  AdminTradeNotFoundException,
} from '#exceptions/admin_trade_errors'
import { RfqNotClosableException, RfqNotExpirableException } from '#exceptions/rfq_errors'
import type { AdminRfqInterventionOptions } from '#shared/types/admin_trade'

/**
 * Interventions de la plateforme sur une demande de devis (#166) : clôturer,
 * faire expirer, relancer les fournisseurs. Chacune réutilise les transitions de
 * `RfqService` et écrit sa trace d'audit **dans la même transaction**.
 */
@inject()
export default class AdminRfqInterventionService {
  constructor(
    private rfqs: RfqService,
    private quotes: QuoteService,
    private notifications: RfqNotificationService,
    private audit: AdminAuditService
  ) {}

  async close({ rfqId, context }: AdminRfqInterventionOptions): Promise<Rfq> {
    return db.transaction(async (trx) => {
      const rfq = await this.find(rfqId, trx)
      if (rfq.status !== 'published') throw new RfqNotClosableException()

      await this.rfqs.close(rfq)
      await this.audit.record(
        {
          action: 'rfq.closed',
          targetType: 'rfq',
          targetId: rfq.id,
          changes: { before: { status: 'published' }, after: { status: 'closed' } },
        },
        { ...context, client: trx }
      )
      return rfq
    })
  }

  /** Les devis encore ouverts de la demande expirent avec elle, dans la même transaction. */
  async expire({ rfqId, context }: AdminRfqInterventionOptions): Promise<Rfq> {
    return db.transaction(async (trx) => {
      const locked = await this.find(rfqId, trx)
      if (locked.status !== 'published') throw new RfqNotExpirableException()

      await this.rfqs.expire(locked, DateTime.now(), trx)
      await this.quotes.expireForRfqs([locked.id], trx)
      await this.audit.record(
        {
          action: 'rfq.expired',
          targetType: 'rfq',
          targetId: locked.id,
          changes: { before: { status: 'published' }, after: { status: 'expired' } },
        },
        { ...context, client: trx }
      )
      return locked
    })
  }

  /**
   * Relance **une fois** chaque destinataire qui n'a ni répondu ni décliné et n'a
   * pas déjà été relancé. Les destinataires sont lus **verrouillés** (`FOR UPDATE`) :
   * deux relances simultanées sont sérialisées et la seconde, qui ne trouve plus
   * personne, reçoit 409. Les mails sont mis en queue dans la transaction ; leur clé
   * d'idempotence évite tout doublon si le commit échoue et que l'admin recommence.
   * Renvoie le nombre de destinataires relancés.
   */
  async remind({ rfqId, context }: AdminRfqInterventionOptions): Promise<number> {
    return db.transaction(async (trx) => {
      const rfq = await this.find(rfqId, trx)
      if (!this.rfqs.acceptsResponses(rfq)) throw new AdminRfqNotRemindableException()

      const recipients = await this.rfqs
        .remindableRecipients(rfq.id, trx)
        .forUpdate()
        .preload('rfq', (query) => query.preload('buyerOrganization'))
        .preload('supplierOrganization')
        .orderBy('id')
      if (recipients.length === 0) throw new AdminRfqNotRemindableException()

      // Aucun mail parti (file en erreur, destinataires sans adresse) : rien n'est
      // consigné, l'admin reçoit 409 plutôt qu'un faux succès.
      const reminded = await this.notifications.remind(recipients)
      if (reminded.length === 0) throw new AdminRfqNotRemindableException()

      await this.rfqs.markReminded(reminded, DateTime.now(), trx)
      await this.audit.record(
        {
          action: 'rfq.reminded',
          targetType: 'rfq',
          targetId: rfq.id,
          changes: { after: { recipients: recipients.length, reminded: reminded.length } },
        },
        { ...context, client: trx }
      )
      return reminded.length
    })
  }

  /**
   * Charge la demande **verrouillée** sur la transaction : deux transitions
   * simultanées (autre admin, job d'expiration, prolongation) sont sérialisées et
   * le statut relu est celui qui sera effectivement remplacé.
   */
  private async find(id: number, trx: TransactionClientContract) {
    const rfq = await Rfq.query({ client: trx }).where('id', id).forUpdate().first()
    if (!rfq) throw new AdminTradeNotFoundException()
    return rfq
  }
}
