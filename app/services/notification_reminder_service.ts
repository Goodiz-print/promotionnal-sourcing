import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import SendMailJob from '#jobs/send_mail_job'
import { notificationHref } from '#transformers/notification_transformer'
import { mailIdempotencyKey } from '#shared/helpers/mail'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'
import {
  NOTIFICATION_EMAIL_FALLBACK,
  type NotificationData,
  type NotificationType,
} from '#shared/types/notification'

/** Nombre maximal de rappels réservés par type et par passe. */
const BATCH_SIZE = 200

interface DueReminderRow {
  id: number
  type: NotificationType
  data: NotificationData
  email: string
  locale: Locale | null
}

/**
 * Rappel par mail des notifications in-app importantes restées non lues (#243).
 *
 * Seuls les types de `NOTIFICATION_EMAIL_FALLBACK` sont concernés : une
 * notification non lue au-delà du délai de son type déclenche **un seul** mail,
 * dans la langue de son destinataire, vers l'écran de la notification.
 *
 * Unicité : chaque passe **réserve** ses notifications par un `UPDATE … SET
 * email_reminded_at` sur une sélection `FOR UPDATE SKIP LOCKED`. Une passe
 * concurrente saute les lignes verrouillées, et une ligne réservée ne repasse
 * plus le filtre. La mise en queue a lieu dans la même transaction : si elle
 * échoue, la réservation est annulée et la passe suivante reprend la
 * notification. La clé d'idempotence par notification couvre les rejeux du mail.
 *
 * Accès par `db` uniquement (aucun modèle Lucid) : le service est importé
 * statiquement par `SendNotificationRemindersJob`, chargé au boot de la queue.
 */
@inject()
export default class NotificationReminderService {
  /** Envoie les rappels dus ; retourne le nombre de mails mis en queue. */
  async sendDue(now: DateTime = DateTime.now()): Promise<number> {
    let sent = 0
    for (const [type, policy] of Object.entries(NOTIFICATION_EMAIL_FALLBACK)) {
      if (!policy) continue
      const cutoff = now.minus({ minutes: policy.delayMinutes })
      sent += await this.sendForType(type as NotificationType, cutoff, now)
    }
    return sent
  }

  private async sendForType(
    type: NotificationType,
    cutoff: DateTime,
    now: DateTime
  ): Promise<number> {
    return db.transaction(async (trx) => {
      const result = await trx.rawQuery<{ rows: DueReminderRow[] }>(
        `UPDATE notifications AS n
            SET email_reminded_at = :now
           FROM users AS u
          WHERE u.id = n.user_id
            AND n.id IN (
              SELECT id FROM notifications
               WHERE type = :type
                 AND read_at IS NULL
                 AND email_reminded_at IS NULL
                 AND created_at <= :cutoff
               ORDER BY id
               LIMIT :limit
                 FOR UPDATE SKIP LOCKED
            )
        RETURNING n.id, n.type, n.data, u.email, u.locale`,
        { now: now.toJSDate(), type, cutoff: cutoff.toJSDate(), limit: BATCH_SIZE }
      )

      for (const row of result.rows) {
        await SendMailJob.dispatch(this.payloadFor(row))
      }
      return result.rows.length
    })
  }

  private payloadFor(row: DueReminderRow): SendMailPayload {
    const kind = MAIL_KINDS.notificationReminder
    const locale = row.locale ?? DEFAULT_LOCALE
    const data = row.data ?? {}
    return {
      kind,
      idempotencyKey: mailIdempotencyKey(kind, { notification: row.id }),
      to: row.email,
      locale,
      data: {
        notificationType: row.type,
        notificationData: data,
        path: notificationHref(row.type, data, locale),
      },
    }
  }
}
