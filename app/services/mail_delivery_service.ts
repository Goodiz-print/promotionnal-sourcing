import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import {
  MAIL_DELIVERY_STATUSES,
  type FailedMailDelivery,
  type SendMailPayload,
} from '#shared/types/mail'

const TABLE = 'mail_deliveries'

interface DeliveryRow {
  idempotency_key: string
  kind: string
  to: string
  error: string | null
  attempts: number
  payload: SendMailPayload | string | null
}

/**
 * Registre `mail_deliveries` : idempotence des envois et dead-letter.
 *
 * Volontairement écrit avec `db` (pas de modèle Lucid) : `SendMailJob` le résout
 * depuis `execute()`, et un job ne doit pas évaluer de modèle au boot de la queue.
 */
export default class MailDeliveryService {
  /**
   * Réserve la clé avant l'envoi (`INSERT … ON CONFLICT DO NOTHING`) et compte
   * la tentative. Retourne `false` si le mail est déjà parti : l'appelant
   * s'arrête sans rien envoyer.
   */
  async begin(payload: SendMailPayload): Promise<boolean> {
    await this.ensureRow(payload)

    const row = await db
      .from(TABLE)
      .where('idempotency_key', payload.idempotencyKey)
      .select('status')
      .first()
    if ((row as { status: string } | null)?.status === MAIL_DELIVERY_STATUSES.sent) return false

    await db
      .from(TABLE)
      .where('idempotency_key', payload.idempotencyKey)
      .update({ attempts: db.raw('attempts + 1'), updated_at: new Date() })
    return true
  }

  /** Le mail est parti : statut `sent`, charge purgée (URL signées). */
  async markSent(idempotencyKey: string): Promise<void> {
    await db.from(TABLE).where('idempotency_key', idempotencyKey).update({
      status: MAIL_DELIVERY_STATUSES.sent,
      sent_at: DateTime.now().toJSDate(),
      error: null,
      payload: null,
      updated_at: new Date(),
    })
  }

  /** Échec (tentative intermédiaire ou définitif) : `failed` + message d'erreur. */
  async markFailed(payload: SendMailPayload, error: Error): Promise<void> {
    await this.ensureRow(payload)
    await db
      .from(TABLE)
      .where('idempotency_key', payload.idempotencyKey)
      .whereNot('status', MAIL_DELIVERY_STATUSES.sent)
      .update({
        status: MAIL_DELIVERY_STATUSES.failed,
        error: error.message,
        updated_at: new Date(),
      })
  }

  /** Nombre de tentatives enregistrées pour une clé (0 si inconnue). */
  async attemptsFor(idempotencyKey: string): Promise<number> {
    const row = await db
      .from(TABLE)
      .where('idempotency_key', idempotencyKey)
      .select('attempts')
      .first()
    return (row as { attempts: number } | null)?.attempts ?? 0
  }

  /** Dead-letter : une clé précise, ou toutes les lignes `failed` (les plus anciennes d'abord). */
  async failed(idempotencyKey?: string): Promise<FailedMailDelivery[]> {
    const query = db
      .from(TABLE)
      .where('status', MAIL_DELIVERY_STATUSES.failed)
      .select('idempotency_key', 'kind', 'to', 'error', 'attempts', 'payload')
      .orderBy('id', 'asc')
    if (idempotencyKey) query.where('idempotency_key', idempotencyKey)

    const rows = (await query) as DeliveryRow[]
    return rows.map((row) => ({
      idempotencyKey: row.idempotency_key,
      kind: row.kind,
      to: row.to,
      error: row.error,
      attempts: row.attempts,
      payload: this.parsePayload(row.payload),
    }))
  }

  /** Statut courant d'une clé, ou `null` si inconnue. */
  async statusOf(idempotencyKey: string): Promise<string | null> {
    const row = await db
      .from(TABLE)
      .where('idempotency_key', idempotencyKey)
      .select('status')
      .first()
    return (row as { status: string } | null)?.status ?? null
  }

  private async ensureRow(payload: SendMailPayload): Promise<void> {
    const now = new Date()
    await db
      .table(TABLE)
      .insert({
        idempotency_key: payload.idempotencyKey,
        kind: payload.kind,
        to: payload.to,
        status: MAIL_DELIVERY_STATUSES.failed,
        attempts: 0,
        payload: JSON.stringify(payload),
        created_at: now,
        updated_at: now,
      })
      .onConflict('idempotency_key')
      .ignore()
  }

  private parsePayload(raw: SendMailPayload | string | null): SendMailPayload | null {
    if (raw === null) return null
    return typeof raw === 'string' ? (JSON.parse(raw) as SendMailPayload) : raw
  }
}
