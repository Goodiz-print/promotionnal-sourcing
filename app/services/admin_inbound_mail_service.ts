import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { DateTime } from 'luxon'
import InboundMailReceived from '#events/inbound_mail_received'
import { AdminInboundMailNotFoundException } from '#exceptions/admin_errors'
import InboundMail from '#models/inbound_mail'
import RfqSupplier from '#models/rfq_supplier'
import AdminAuditService from '#services/admin_audit_service'
import InboundAddressService from '#services/inbound_address_service'
import InboundMailService from '#services/inbound_mail_service'
import {
  ADMIN_INBOUND_MAIL_CANDIDATES_LIMIT,
  INBOUND_MAIL_ATTACHABLE_STATUSES,
  INBOUND_MAIL_DISMISSABLE_STATUSES,
  INBOUND_MAIL_REPLAYABLE_STATUSES,
  type AdminInboundMailListQuery,
  type AdminInboundMailOutcome,
  type AdminInboundMailOverview,
} from '#shared/types/admin_inbound_mail'
import type {
  AdminActionContext,
  AdminAuditAction,
  AdminAuditChanges,
} from '#shared/types/admin_audit'
import {
  INBOUND_MAIL_REJECTIONS,
  INBOUND_MAIL_STATUSES,
  type InboundMailStatus,
} from '#shared/types/inbound_mail'

/** Colonnes de la liste : ni corps ni en-têtes, qui peuvent peser lourd. */
const LIST_COLUMNS = [
  'id',
  'rfq_supplier_id',
  'recipient',
  'sender_address',
  'sender_name',
  'subject',
  'status',
  'rejection_reason',
  'error',
  'attached_manually_at',
  'received_at',
  'processed_at',
]

/** Colonnes de la fiche : le HTML et les en-têtes bruts ne sont jamais affichés. */
const DETAIL_COLUMNS = [
  ...LIST_COLUMNS,
  'provider',
  'message_id',
  'sender_known',
  'size_bytes',
  'text_body',
]

/** Entrée du journal d'audit pour un mail entrant. */
interface InboundMailTrace {
  action: AdminAuditAction
  inboundMailId: number
  changes: AdminAuditChanges
}

/** Le domaine d'une adresse, motifs `LIKE` neutralisés. */
function senderDomainPattern(address: string): string {
  const domain = address.slice(address.lastIndexOf('@') + 1).toLowerCase()
  return `%@${domain.replace(/[\\%_]/g, (char) => `\\${char}`)}`
}

/**
 * Supervision des mails entrants (#227, `docs/mail.md`) : liste et fiche du
 * journal `inbound_mails`, et trois actions d'admin.
 *
 * - **rattacher** un mail au couple demande / fournisseur qu'il visait
 *   (adresse relais inconnue, expirée, réponse automatique détectée à tort) ;
 * - **rejouer** son traitement (`InboundMailService#process`). Le verrou de
 *   statut et les écritures idempotentes en aval (`messages.inbound_mail_id`
 *   unique, pièces jointes dédoublonnées) font qu'un rejeu ne crée jamais de
 *   doublon ; un mail déjà traité ne rejoue que l'enregistrement de la réponse ;
 * - **écarter** un mail en attente ou en échec (motif `dismissed`).
 *
 * Chaque action verrouille la ligne, vérifie son état et écrit l'audit dans la
 * même transaction ; le traitement lui-même tourne après le commit.
 */
@inject()
export default class AdminInboundMailService {
  constructor(
    private audit: AdminAuditService,
    private inboundMails: InboundMailService,
    private addresses: InboundAddressService
  ) {}

  async overview(): Promise<AdminInboundMailOverview> {
    const rows = await db
      .from(InboundMail.table)
      .select('status')
      .count('* as total')
      .groupBy('status')
    const counts = new Map(rows.map((row) => [row.status as string, Number(row.total)]))
    return Object.fromEntries(
      Object.values(INBOUND_MAIL_STATUSES).map((status) => [status, counts.get(status) ?? 0])
    ) as AdminInboundMailOverview
  }

  list(query: AdminInboundMailListQuery): Promise<ModelPaginatorContract<InboundMail>> {
    return InboundMail.query()
      .select(LIST_COLUMNS)
      .if(query.status, (builder) => builder.where('status', query.status!))
      .if(query.rejection, (builder) => builder.where('rejection_reason', query.rejection!))
      .preload('rfqSupplier', (recipient) =>
        recipient.preload('rfq').preload('supplierOrganization')
      )
      .orderBy('received_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(query.page, query.perPage)
  }

  async show(id: number): Promise<InboundMail> {
    const mail = await InboundMail.query()
      .select(DETAIL_COLUMNS)
      .where('id', id)
      .preload('attachments', (attachments) => attachments.orderBy('id'))
      .preload('rfqSupplier', (recipient) =>
        recipient.preload('rfq').preload('supplierOrganization')
      )
      .first()
    if (!mail) throw new AdminInboundMailNotFoundException()
    return mail
  }

  /**
   * Couples demande / fournisseur proposés au rattachement : ceux d'une demande
   * précise si l'admin en donne le numéro, sinon ceux des fournisseurs dont
   * l'adresse (organisation ou membre) est du domaine de l'expéditeur. Les plus
   * récemment envoyés d'abord.
   */
  candidates(mail: InboundMail, rfqId: number | null): Promise<RfqSupplier[]> {
    const query = RfqSupplier.query()
      .whereNotNull('sent_at')
      .preload('rfq')
      .preload('supplierOrganization')
      .orderBy('sent_at', 'desc')
      .orderBy('id', 'desc')
      .limit(ADMIN_INBOUND_MAIL_CANDIDATES_LIMIT)
    if (rfqId) return query.where('rfq_id', rfqId)

    const pattern = senderDomainPattern(mail.senderAddress)
    return query.whereHas('supplierOrganization', (organization) => {
      organization
        .whereRaw('lower(email) like ?', [pattern])
        .orWhereHas('users', (user) => user.whereRaw('lower(email) like ?', [pattern]))
    })
  }

  /**
   * Rattache le mail au couple choisi puis le traite : le traitement suit ce
   * rattachement plutôt que l'adresse relais (`InboundMailService`).
   */
  async attach(
    id: number,
    rfqSupplierId: number,
    context: AdminActionContext
  ): Promise<AdminInboundMailOutcome> {
    const attached = await db.transaction(async (trx) => {
      const mail = await this.lock(trx, id, INBOUND_MAIL_ATTACHABLE_STATUSES)
      if (!mail) return false

      const before = { status: mail.status, rfqSupplierId: mail.rfqSupplierId }
      await mail
        .useTransaction(trx)
        .merge({
          rfqSupplierId,
          attachedManuallyAt: DateTime.now(),
          status: INBOUND_MAIL_STATUSES.received,
          rejectionReason: null,
          error: null,
        })
        .save()
      const after = { status: mail.status, rfqSupplierId }
      await this.trace(
        { action: 'inbound_mail.attached', inboundMailId: id, changes: { before, after } },
        context,
        trx
      )
      return true
    })
    return attached ? this.process(id) : 'refused'
  }

  /** Rejoue le traitement du mail. */
  async replay(id: number, context: AdminActionContext): Promise<AdminInboundMailOutcome> {
    const previous = await db.transaction((trx) => this.reopen(trx, id, context))
    if (!previous) return 'refused'
    if (previous.status === INBOUND_MAIL_STATUSES.processed) {
      return this.republish(id, previous)
    }
    return this.process(id)
  }

  /** Écarte un mail en attente ou en échec : il n'est plus repris. */
  dismiss(id: number, context: AdminActionContext): Promise<boolean> {
    return db.transaction(async (trx) => {
      const mail = await this.lock(trx, id, INBOUND_MAIL_DISMISSABLE_STATUSES)
      if (!mail) return false

      const before = { status: mail.status }
      await mail
        .useTransaction(trx)
        .merge({
          status: INBOUND_MAIL_STATUSES.rejected,
          rejectionReason: INBOUND_MAIL_REJECTIONS.dismissed,
          processedAt: DateTime.now(),
        })
        .save()
      const after = { status: mail.status, rejectionReason: mail.rejectionReason }
      await this.trace(
        { action: 'inbound_mail.dismissed', inboundMailId: id, changes: { before, after } },
        context,
        trx
      )
      return true
    })
  }

  /**
   * Remet en attente (`received`) un mail rejouable, pour que le traitement le
   * reprenne ; un mail traité reste tel quel. Renvoie son état d'avant.
   */
  private async reopen(
    trx: TransactionClientContract,
    id: number,
    context: AdminActionContext
  ): Promise<Pick<InboundMail, 'status' | 'rfqSupplierId' | 'recipient'> | null> {
    const mail = await this.lock(trx, id, INBOUND_MAIL_REPLAYABLE_STATUSES)
    if (!mail) return null

    const before = { status: mail.status, rfqSupplierId: mail.rfqSupplierId }
    const { recipient } = mail
    if (mail.status !== INBOUND_MAIL_STATUSES.processed) {
      await mail.useTransaction(trx).merge({ status: INBOUND_MAIL_STATUSES.received }).save()
    }
    const after = { status: mail.status }
    await this.trace(
      { action: 'inbound_mail.replayed', inboundMailId: id, changes: { before, after } },
      context,
      trx
    )
    return { ...before, recipient }
  }

  /** Le mail, verrouillé, s'il est dans l'un des états attendus. */
  private lock(
    trx: TransactionClientContract,
    id: number,
    statuses: InboundMailStatus[]
  ): Promise<InboundMail | null> {
    return InboundMail.query({ client: trx })
      .where('id', id)
      .whereIn('status', statuses)
      .forUpdate()
      .first()
  }

  /**
   * Traite le mail. Une erreur le laisse `failed` (`InboundMailService`), et la
   * reprise planifiée le rejouera : elle n'est que loguée. Renvoie son état.
   */
  private async process(id: number): Promise<AdminInboundMailOutcome> {
    try {
      await this.inboundMails.process(id)
    } catch (error) {
      logger.warn({ err: error, inboundMailId: id }, 'admin inbound mail processing failed')
    }
    const mail = await InboundMail.query().where('id', id).select('id', 'status').firstOrFail()
    return mail.status
  }

  /**
   * Mail déjà traité : seul l'enregistrement de la réponse est rejoué
   * (`InboundMailReceived`). `SupplierReplyService#record` est idempotent : un
   * message et ses devis déjà enregistrés ne le sont pas une seconde fois, pas
   * plus qu'un message de l'agence (`AgencyReplyService#record`, #226). Le côté
   * qui écrit se relit sur l'adresse relais visée.
   */
  private async republish(
    id: number,
    { rfqSupplierId, recipient }: Pick<InboundMail, 'rfqSupplierId' | 'recipient'>
  ): Promise<AdminInboundMailOutcome> {
    if (!rfqSupplierId) return 'refused'
    const side = this.addresses.sideOf(recipient)
    try {
      await emitter.emit(
        InboundMailReceived,
        new InboundMailReceived({ inboundMailId: id, rfqSupplierId, side })
      )
    } catch (error) {
      logger.error({ err: error, inboundMailId: id }, 'admin inbound mail republish failed')
      return INBOUND_MAIL_STATUSES.failed
    }
    return 'republished'
  }

  private async trace(
    entry: InboundMailTrace,
    context: AdminActionContext,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.audit.record(
      {
        action: entry.action,
        targetType: 'inbound_mail',
        targetId: entry.inboundMailId,
        changes: entry.changes,
      },
      { ...context, client: trx }
    )
  }
}
