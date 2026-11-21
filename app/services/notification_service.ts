import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Notification from '#models/notification'
import RealtimeService from '#services/realtime_service'
import User from '#models/user'
import {
  NotificationNotFoundException,
  UnknownNotificationTypeException,
} from '#exceptions/notification_errors'
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_TYPES,
  type NotificationData,
  type NotificationType,
} from '#shared/types/notification'

interface ListOptions {
  unreadOnly?: boolean
  limit?: number
}

/**
 * Notifications in-app (#57). Persistance et lecture seulement : l'envoi temps
 * réel (Transmit) se branche par-dessus `notify`, sans changer le modèle.
 *
 * Accès via le modèle Lucid : ce service n'est jamais appelé depuis un job qui
 * se charge au boot (cf. règle des jobs dans CLAUDE.md).
 */
@inject()
export default class NotificationService {
  constructor(private realtime: RealtimeService) {}

  /**
   * Crée une notification pour `user`. Le type doit appartenir à `NOTIFICATION_TYPES`.
   */
  async notify(
    user: Pick<User, 'id'>,
    type: NotificationType,
    data: NotificationData = {}
  ): Promise<Notification> {
    this.assertKnownType(type)
    const notification = await Notification.create({ userId: user.id, type, data, readAt: null })
    this.announce(user.id, notification.id, type)
    return notification
  }

  /**
   * Comme `notify`, mais **sans doublon** : une notification qu'un index unique
   * interdit (ex. `(user_id, type, data->>'messageId')`, #225) n'est pas
   * recréée. `INSERT … ON CONFLICT DO NOTHING` : un doublon, même concurrent,
   * ne lève pas d'erreur — et n'avorte donc pas une transaction englobante.
   * Renvoie l'id créé, ou `null` si la notification existait déjà.
   */
  async notifyOnce(
    user: Pick<User, 'id'>,
    type: NotificationType,
    data: NotificationData
  ): Promise<number | null> {
    this.assertKnownType(type)
    const now = new Date()
    const inserted = await db
      .table(Notification.table)
      .insert({
        user_id: user.id,
        type,
        data: JSON.stringify(data),
        read_at: null,
        created_at: now,
        updated_at: now,
      })
      .onConflict()
      .ignore()
      .returning('id')
    if (inserted.length === 0) return null

    const id = Number(inserted[0].id)
    this.announce(user.id, id, type)
    return id
  }

  private assertKnownType(type: NotificationType): void {
    if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
      throw new UnknownNotificationTypeException()
    }
  }

  /** Pousse la nouvelle notification à l'utilisateur (Transmit). */
  private announce(userId: number, notificationId: number, type: NotificationType): void {
    this.realtime.notifyUser(userId, {
      type: 'notification.created',
      notificationId,
      notificationType: type,
    })
  }

  /** Notifications de l'utilisateur, les plus récentes d'abord. */
  listFor(
    user: Pick<User, 'id'>,
    { unreadOnly = false, limit = NOTIFICATION_PAGE_SIZE }: ListOptions = {}
  ) {
    return Notification.query()
      .where('userId', user.id)
      .if(unreadOnly, (query) => query.whereNull('readAt'))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
  }

  /** Nombre de notifications non lues (pastille de la cloche). */
  async unreadCount(user: Pick<User, 'id'>): Promise<number> {
    const row = await Notification.query()
      .where('userId', user.id)
      .whereNull('readAt')
      .count('* as total')
      .first()
    return Number(row?.$extras.total ?? 0)
  }

  /**
   * Marque une notification comme lue. Idempotent : une notification déjà lue
   * garde sa date de lecture. Lève si elle n'appartient pas à `user`.
   */
  async markRead(user: Pick<User, 'id'>, notificationId: number): Promise<Notification> {
    const notification = await Notification.query()
      .where('id', notificationId)
      .where('userId', user.id)
      .first()
    if (!notification) throw new NotificationNotFoundException()

    if (notification.readAt === null) {
      notification.readAt = DateTime.now()
      await notification.save()
    }
    return notification
  }

  /** Marque toutes les notifications non lues de `user` comme lues. */
  async markAllRead(user: Pick<User, 'id'>): Promise<void> {
    await Notification.query()
      .where('userId', user.id)
      .whereNull('readAt')
      .update({ readAt: DateTime.now().toJSDate() })
  }
}
