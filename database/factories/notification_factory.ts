import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import Notification from '#models/notification'
import { NOTIFICATION_TYPES } from '#shared/types/notification'

/**
 * Notification non lue. `userId` reste à fournir par l'appelant
 * (`.merge({ userId })`) : une notification n'a pas de sens sans destinataire.
 */
export const NotificationFactory = factory
  .define(Notification, ({ faker }) => ({
    type: faker.helpers.arrayElement(NOTIFICATION_TYPES),
    data: {},
    readAt: null,
  }))
  .state('read', (notification) => {
    notification.readAt = DateTime.now()
  })
  .build()
