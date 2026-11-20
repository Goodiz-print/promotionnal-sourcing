import {
  BUYER_ANONYMIZED_NOTIFICATION_TYPES,
  type NotificationData,
  type NotificationType,
} from '../types/notification.js'

/**
 * Clé du texte d'une notification, partagée par la cloche et le mail de rappel
 * (#243) : `notifications.types.<type>`, ou `notifications.anonymous.<type>`
 * quand la notification ne nomme pas l'agence (fournisseur non abonné, #220).
 */
export function notificationMessageKey(type: NotificationType, data: NotificationData): string {
  const anonymizable = (BUYER_ANONYMIZED_NOTIFICATION_TYPES as readonly string[]).includes(type)
  if (anonymizable && !data.buyerName) return `notifications.anonymous.${type}`
  return `notifications.types.${type}`
}
