import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  STRIPE_WEBHOOK_EVENT_RETENTION_DAYS,
  type BillingWebhookEvent,
} from '#shared/types/subscription'

/**
 * Registre des notifications Stripe d'abonnement déjà traitées
 * (`stripe_webhook_events`, cf. `docs/abonnements.md`) : idempotence du webhook
 * et purge planifiée. Accès par `db` : utilisé depuis un job (pas de modèle Lucid).
 */
export default class StripeWebhookEventService {
  /** La notification a-t-elle déjà été traitée ? Lecture hors transaction, sans verrou. */
  async isProcessed(eventId: string): Promise<boolean> {
    const row = await db.from('stripe_webhook_events').where('event_id', eventId).first()
    return Boolean(row)
  }

  /**
   * Enregistre la notification dans la transaction de son traitement. Renvoie
   * `false` si elle l'était déjà (traitement concurrent) : l'appelant s'arrête.
   */
  async record(event: BillingWebhookEvent, trx: TransactionClientContract): Promise<boolean> {
    const inserted = await trx
      .insertQuery()
      .table('stripe_webhook_events')
      .insert({ event_id: event.id, type: event.type, created_at: new Date() })
      .onConflict('event_id')
      .ignore()
      .returning('id')
    return inserted.length > 0
  }

  /** Supprime les notifications plus vieilles que la rétention ; renvoie le nombre supprimé. */
  async purge(now: Date = new Date()): Promise<number> {
    const limit = new Date(now.getTime() - STRIPE_WEBHOOK_EVENT_RETENTION_DAYS * 86_400_000)
    const deleted = await db.from('stripe_webhook_events').where('created_at', '<', limit).delete()
    return Number(deleted)
  }
}
