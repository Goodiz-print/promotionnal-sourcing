import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import SendMailJob from '#jobs/send_mail_job'
import AdminAuditService from '#services/admin_audit_service'
import { AdminMailNotFoundException } from '#exceptions/admin_errors'
import {
  MAIL_BULK_RETRY_LIMIT,
  MAIL_ERROR_MAX_LENGTH,
  MAIL_ERROR_SUMMARY_LENGTH,
  MAIL_IN_PROGRESS_MINUTES,
  MAIL_RATE_WINDOW_DAYS,
  type AdminMailDetail,
  type AdminMailFilters,
  type AdminMailKindRate,
  type AdminMailOverview,
  type AdminMailRetryResult,
  type AdminMailRow,
  type AdminMailStatus,
} from '#shared/types/admin_ops'
import type { AdminActionContext } from '#shared/types/admin_audit'
import { MAIL_DELIVERY_STATUSES, type MailKind, type SendMailPayload } from '#shared/types/mail'
import type { Paginated } from '#shared/types/pagination'

const TABLE = 'mail_deliveries'

interface DeliveryDbRow {
  id: number
  idempotency_key: string
  kind: string
  to: string
  status: string
  attempts: number
  error: string | null
  payload: unknown
  created_at: Date
  updated_at: Date
  sent_at: Date | null
}

const COLUMNS = [
  'id',
  'idempotency_key',
  'kind',
  'to',
  'status',
  'attempts',
  'error',
  'created_at',
  'updated_at',
  'sent_at',
] as const

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max)}…` : value
const iso = (value: Date | string | null) => (value === null ? null : new Date(value).toISOString())

/**
 * Supervision des envois de mails (#178), au-dessus du registre
 * `mail_deliveries` (#59). Lecture et rejeu passent par la même table que
 * `MailDeliveryService` et `node ace mail:retry` : un rejeu remet le **même**
 * `SendMailPayload` en queue, avec sa clé d'idempotence — un mail déjà parti n'est
 * jamais renvoyé.
 *
 * Écrit avec `db` (la table n'a pas de modèle Lucid).
 */
@inject()
export default class AdminMailService {
  constructor(private audit: AdminAuditService) {}

  async overview(): Promise<AdminMailOverview> {
    const since = DateTime.now().minus({ days: MAIL_RATE_WINDOW_DAYS }).toJSDate()
    const settledBefore = this.settledBefore()

    const rows = await db
      .from(TABLE)
      .where('created_at', '>=', since)
      .select('kind')
      .select(db.raw('count(*) filter (where status = ?) as sent', [MAIL_DELIVERY_STATUSES.sent]))
      .select(
        db.raw('count(*) filter (where status = ? and updated_at <= ?) as failed', [
          MAIL_DELIVERY_STATUSES.failed,
          settledBefore,
        ])
      )
      .select(
        db.raw('count(*) filter (where status = ? and updated_at > ?) as in_progress', [
          MAIL_DELIVERY_STATUSES.failed,
          settledBefore,
        ])
      )
      .groupBy('kind')
      .orderBy('kind', 'asc')

    const rates: AdminMailKindRate[] = rows.map((row) => {
      const sent = Number(row.sent)
      const failed = Number(row.failed)
      return {
        kind: row.kind as MailKind,
        sent,
        failed,
        inProgress: Number(row.in_progress),
        failureRate: sent + failed === 0 ? null : failed / (sent + failed),
      }
    })

    const failedTotal = await this.settledFailures()
      .whereNotNull('payload')
      .count('* as total')
      .first()
    return {
      windowDays: MAIL_RATE_WINDOW_DAYS,
      failedTotal: Number(failedTotal?.total ?? 0),
      rates,
    }
  }

  async list(
    filters: AdminMailFilters & { page: number; perPage: number }
  ): Promise<Paginated<AdminMailRow>> {
    const settledBefore = this.settledBefore()
    const query = db.from(TABLE).select(...COLUMNS, db.raw('(payload is not null) as has_payload'))

    if (filters.kind) query.where('kind', filters.kind)
    if (filters.status === 'sent') query.where('status', MAIL_DELIVERY_STATUSES.sent)
    else if (filters.status === 'failed') {
      query.where('status', MAIL_DELIVERY_STATUSES.failed).where('updated_at', '<=', settledBefore)
    } else if (filters.status === 'in_progress') {
      query.where('status', MAIL_DELIVERY_STATUSES.failed).where('updated_at', '>', settledBefore)
    }

    const paginator = await query
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .paginate(filters.page, filters.perPage)
    const { data, meta } = paginator.toJSON()

    return {
      data: data.map((row: DeliveryDbRow & { has_payload: boolean }) =>
        this.present(row, row.has_payload, settledBefore)
      ),
      meta: {
        total: meta.total,
        perPage: meta.perPage,
        currentPage: meta.currentPage,
        lastPage: meta.lastPage,
      },
    }
  }

  async show(id: number): Promise<AdminMailDetail> {
    const row = (await db
      .from(TABLE)
      .where('id', id)
      .select(...COLUMNS, db.raw('(payload is not null) as has_payload'))
      .first()) as (DeliveryDbRow & { has_payload: boolean }) | null
    if (!row) throw new AdminMailNotFoundException()

    return {
      ...this.present(row, row.has_payload, this.settledBefore()),
      idempotencyKey: row.idempotency_key,
      fullError: row.error ? truncate(row.error, MAIL_ERROR_MAX_LENGTH) : null,
    }
  }

  /**
   * Rejoue un mail de la dead-letter. `null` s'il n'existe plus ou n'est plus
   * rejouable (déjà parti, déjà rejoué, en cours, charge purgée).
   */
  retryOne(id: number, context: AdminActionContext): Promise<AdminMailRetryResult | null> {
    return this.requeue({ id }, 'mail.retried', context)
  }

  /**
   * Rejoue la dead-letter, d'un type de mail ou de tous, dans la limite de
   * `MAIL_BULK_RETRY_LIMIT` (les plus anciens d'abord).
   */
  async retryAll(
    kind: MailKind | null,
    context: AdminActionContext
  ): Promise<AdminMailRetryResult> {
    const result = await this.requeue({ kind }, 'mail.bulk_retried', context)
    return result as AdminMailRetryResult
  }

  /**
   * Verrouille les lignes rejouables, les passe « en cours » (`updated_at`) et
   * écrit l'audit dans la même transaction, puis met les mails en queue **après le
   * commit**. Deux admins qui rejouent en même temps ne remettent donc pas le même
   * mail deux fois, et un clic répété ne le fait pas non plus : la ligne n'est plus
   * dans la dead-letter avant `MAIL_IN_PROGRESS_MINUTES`. Une mise en queue qui échoue
   * rend sa ligne à la dead-letter aussitôt (`updated_at` d'origine) et est comptée dans
   * `failed`. Seules les lignes **avec charge** sont sélectionnées : celles dont la charge
   * est purgée ne consomment pas la limite du lot (elles sont comptées dans `skipped`).
   */
  private async requeue(
    target: { id: number } | { kind: MailKind | null },
    action: 'mail.retried' | 'mail.bulk_retried',
    context: AdminActionContext
  ): Promise<AdminMailRetryResult | null> {
    const single = 'id' in target
    const kind = 'kind' in target ? target.kind : null
    const batch: { id: number; previousUpdatedAt: Date; payload: SendMailPayload }[] = []
    let skipped = 0

    await db.transaction(async (trx) => {
      const query = this.settledFailures(trx)
        .whereNotNull('payload')
        .select('id', 'payload', 'updated_at')
      if (single) query.where('id', target.id)
      else if (kind) query.where('kind', kind)
      const rows = (await query
        .orderBy('id', 'asc')
        .limit(single ? 1 : MAIL_BULK_RETRY_LIMIT)
        .forUpdate()
        .skipLocked()) as Pick<DeliveryDbRow, 'id' | 'payload' | 'updated_at'>[]

      for (const row of rows) {
        const payload = this.parsePayload(row.payload)
        if (payload) batch.push({ id: row.id, previousUpdatedAt: row.updated_at, payload })
      }
      if (batch.length === 0) return

      if (!single) {
        const unreplayable = this.settledFailures(trx).whereNull('payload').count('* as total')
        if (kind) unreplayable.where('kind', kind)
        const purged = await unreplayable.first()
        skipped = Number(purged?.total ?? 0)
      }

      await trx
        .from(TABLE)
        .whereIn(
          'id',
          batch.map((entry) => entry.id)
        )
        .update({ updated_at: new Date() })
      await this.audit.record(
        {
          action,
          targetType: 'mail_delivery',
          targetId: single ? target.id : null,
          changes: {
            after: single
              ? { kind: batch[0].payload.kind }
              : { kind, requeued: batch.length, skipped },
          },
        },
        { ...context, client: trx }
      )
    })

    if (batch.length === 0) return single ? null : { requeued: 0, failed: 0, skipped }

    let failed = 0
    for (const entry of batch) {
      try {
        await SendMailJob.dispatch(entry.payload)
      } catch (error) {
        failed += 1
        logger.error({ err: error, mailDeliveryId: entry.id }, 'admin mail retry: dispatch failed')
        await db.from(TABLE).where('id', entry.id).update({ updated_at: entry.previousUpdatedAt })
      }
    }
    return { requeued: batch.length - failed, failed, skipped }
  }

  private settledBefore(): Date {
    return DateTime.now().minus({ minutes: MAIL_IN_PROGRESS_MINUTES }).toJSDate()
  }

  /** Dead-letter : `failed` et plus modifiée depuis `MAIL_IN_PROGRESS_MINUTES`. */
  private settledFailures(client: Pick<typeof db, 'from'> = db) {
    return client
      .from(TABLE)
      .where('status', MAIL_DELIVERY_STATUSES.failed)
      .where('updated_at', '<=', this.settledBefore())
  }

  private present(row: DeliveryDbRow, hasPayload: boolean, settledBefore: Date): AdminMailRow {
    const status = this.statusOf(row, settledBefore)
    return {
      id: row.id,
      kind: row.kind,
      to: row.to,
      status,
      attempts: Number(row.attempts),
      error: row.error ? truncate(row.error.split('\n')[0], MAIL_ERROR_SUMMARY_LENGTH) : null,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
      sentAt: iso(row.sent_at),
      retryable: status === 'failed' && hasPayload,
    }
  }

  private statusOf(row: DeliveryDbRow, settledBefore: Date): AdminMailStatus {
    if (row.status === MAIL_DELIVERY_STATUSES.sent) return 'sent'
    return new Date(row.updated_at) <= settledBefore ? 'failed' : 'in_progress'
  }

  private parsePayload(raw: unknown): SendMailPayload | null {
    if (raw === null || raw === undefined) return null
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as SendMailPayload
  }
}
