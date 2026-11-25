import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import SendMailJob from '#jobs/send_mail_job'
import { notificationHref } from '#transformers/notification_transformer'
import { mailIdempotencyKey } from '#shared/helpers/mail'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { MAIL_KINDS, type SendMailPayload } from '#shared/types/mail'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import {
  NOTIFICATION_EMAIL_FALLBACK,
  NOTIFICATION_REMINDER_MAX_AGE_HOURS,
  type NotificationEmailFallbackPolicy,
  type NotificationData,
  type NotificationType,
} from '#shared/types/notification'

/**
 * Nombre maximal de rappels réservés par type et par passe. Petit : les lignes
 * restent verrouillées le temps de leur mise en queue (un `markRead` simultané
 * attend la fin de la transaction).
 */
const BATCH_SIZE = 50

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
 * Échec de mise en queue : il est isolé **ligne par ligne**. Seule la ligne en
 * échec est libérée (`email_reminded_at` remis à null, reprise à la passe
 * suivante) ; les mails déjà mis en queue du lot gardent leur réservation, ce qui
 * empêche une seconde mise en queue pendant que le premier envoi est en retry.
 *
 * Bornes : une notification plus vieille que `NOTIFICATION_REMINDER_MAX_AGE_HOURS`
 * n'est plus rappelée, et `recipientPlatformRole` exclut un destinataire qui n'a
 * plus le rôle requis.
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
      sent += await this.sendForType(type as NotificationType, policy, now)
    }
    return sent
  }

  private async sendForType(
    type: NotificationType,
    policy: NotificationEmailFallbackPolicy,
    now: DateTime
  ): Promise<number> {
    return db.transaction(async (trx) => {
      const rows = await this.reserve(trx, type, policy, now)
      let sent = 0
      for (const row of rows) {
        try {
          await SendMailJob.dispatch(this.payloadFor(row))
          sent++
        } catch (error) {
          logger.warn(
            { err: error, notificationId: row.id },
            'notification reminder not queued, released for the next run'
          )
          await trx.from('notifications').where('id', row.id).update({ email_reminded_at: null })
        }
      }
      return sent
    })
  }

  /** Réserve (verrouille et marque) les notifications dues du type. */
  private async reserve(
    trx: TransactionClientContract,
    type: NotificationType,
    policy: NotificationEmailFallbackPolicy,
    now: DateTime
  ): Promise<DueReminderRow[]> {
    // Requête au texte fixe : toutes les valeurs passent par des bindings nommés
    // (paramètres `$n` côté `pg`). Sans rôle requis, `:role` vaut '' (aucun rôle
    // plateforme n'est vide) et la condition est neutre.
    const result = await trx.rawQuery<{ rows: DueReminderRow[] }>(
      `UPDATE notifications AS n
          SET email_reminded_at = :now
         FROM users AS u
        WHERE u.id = n.user_id
          AND n.id IN (
            SELECT nn.id FROM notifications AS nn
              JOIN users AS uu ON uu.id = nn.user_id
             WHERE nn.type = :type
               AND nn.read_at IS NULL
               AND nn.email_reminded_at IS NULL
               AND nn.created_at <= :cutoff
               AND nn.created_at > :oldest
               AND (:role = '' OR uu.platform_role = :role)
             ORDER BY nn.id
             LIMIT :limit
               FOR UPDATE OF nn SKIP LOCKED
          )
      RETURNING n.id, n.type, n.data, u.email, u.locale`,
      {
        now: now.toJSDate(),
        type,
        cutoff: now.minus({ minutes: policy.delayMinutes }).toJSDate(),
        oldest: now.minus({ hours: NOTIFICATION_REMINDER_MAX_AGE_HOURS }).toJSDate(),
        limit: BATCH_SIZE,
        role: policy.recipientPlatformRole ?? '',
      }
    )
    return result.rows
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
