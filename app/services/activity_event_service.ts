import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import RecordActivityEventJob from '#jobs/record_activity_event_job'
import ActivityEvent from '#models/activity_event'
import {
  ACTIVITY_EVENT_DEDUP_MINUTES,
  ACTIVITY_EVENT_PSEUDONYMIZE_AFTER_DAYS,
  ACTIVITY_EVENT_RETENTION_DAYS,
  type ActivityEventPurgeResult,
  type ActivityEventInput,
  type ActivityEventPayload,
} from '#shared/types/activity_event'

/**
 * Consultations et funnel acheteur (#172).
 *
 * `record` ne bloque jamais l'écran : mise en queue asynchrone, erreurs loggées
 * sans être propagées. Les consultations du back-office (rôle plateforme) ne
 * sont pas comptées ; `store` écarte en plus un fournisseur qui consulte ses
 * propres fiches et les vues répétées d'un utilisateur connecté.
 */
@inject()
export default class ActivityEventService {
  async record(input: ActivityEventInput): Promise<void> {
    if (input.isStaff) return

    try {
      const payload: ActivityEventPayload = {
        type: input.type,
        targetType: input.targetType,
        targetId: input.targetId,
        userId: input.userId,
        organizationId: input.organizationId,
        occurredAt: DateTime.now().toISO()!,
      }
      await RecordActivityEventJob.dispatch(payload)
    } catch (error) {
      logger.warn({ err: error, type: input.type }, 'failed to queue activity event')
    }
  }

  /** Écriture effective, appelée par le job. `null` : événement écarté. */
  async store(payload: ActivityEventPayload): Promise<ActivityEvent | null> {
    if (await this.isOwnTarget(payload)) return null
    if (await this.isRepeatedView(payload)) return null

    return ActivityEvent.create({
      type: payload.type,
      targetType: payload.targetType,
      targetId: payload.targetId,
      userId: payload.userId,
      organizationId: payload.organizationId,
      createdAt: DateTime.fromISO(payload.occurredAt),
    })
  }

  /** Détache l'utilisateur et l'organisation après 90 jours, supprime après 24 mois. Idempotent. */
  async purge(now: DateTime = DateTime.now()): Promise<ActivityEventPurgeResult> {
    const pseudonymizeBefore = now.minus({ days: ACTIVITY_EVENT_PSEUDONYMIZE_AFTER_DAYS }).toSQL()!
    const deleteBefore = now.minus({ days: ACTIVITY_EVENT_RETENTION_DAYS }).toSQL()!

    return db.transaction(async (trx) => {
      const deleted = await ActivityEvent.query({ client: trx })
        .where('createdAt', '<', deleteBefore)
        .delete()
      const pseudonymized = await ActivityEvent.query({ client: trx })
        .where('createdAt', '<', pseudonymizeBefore)
        .where((query) => query.whereNotNull('userId').orWhereNotNull('organizationId'))
        .update({ userId: null, organizationId: null })

      return { deleted: Number(deleted), pseudonymized: Number(pseudonymized) }
    })
  }

  /** Un fournisseur qui consulte sa propre fiche ou l'un de ses produits. */
  private async isOwnTarget(payload: ActivityEventPayload): Promise<boolean> {
    if (!payload.organizationId) return false

    if (payload.targetType === 'supplier') {
      const row = await db
        .from('suppliers')
        .where('id', payload.targetId)
        .where('organization_id', payload.organizationId)
        .first()
      return Boolean(row)
    }
    if (payload.targetType === 'product') {
      const row = await db
        .from('products')
        .join('suppliers', 'suppliers.id', 'products.supplier_id')
        .where('products.id', payload.targetId)
        .where('suppliers.organization_id', payload.organizationId)
        .first()
      return Boolean(row)
    }
    return false
  }

  /** Vue déjà comptée pour cet utilisateur sur la fenêtre de dédoublonnage. */
  private async isRepeatedView(payload: ActivityEventPayload): Promise<boolean> {
    if (!payload.userId || !payload.type.endsWith('_viewed')) return false

    const since = DateTime.fromISO(payload.occurredAt).minus({
      minutes: ACTIVITY_EVENT_DEDUP_MINUTES,
    })
    const row = await ActivityEvent.query()
      .where('userId', payload.userId)
      .where('type', payload.type)
      .where('targetType', payload.targetType)
      .where('targetId', payload.targetId)
      .where('createdAt', '>=', since.toSQL()!)
      .first()
    return Boolean(row)
  }
}
