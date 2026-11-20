import {
  BUYER_ANONYMIZED_NOTIFICATION_TYPES,
  type BuyerAnonymizedNotificationType,
  type NotificationData,
  type NotificationType,
} from '../types/notification.js'

/** Le type de notification peut-il partir sans nom d'agence (#220) ? */
export function isBuyerAnonymizedType(
  type: NotificationType
): type is BuyerAnonymizedNotificationType {
  return BUYER_ANONYMIZED_NOTIFICATION_TYPES.some((anonymized) => anonymized === type)
}

/**
 * Clé du texte d'une notification, partagée par la cloche et le mail de rappel
 * (#243) : `notifications.types.<type>`, ou `notifications.anonymous.<type>`
 * quand la notification ne nomme pas l'agence (fournisseur non abonné, #220).
 */
export function notificationMessageKey(type: NotificationType, data: NotificationData): string {
  if (isBuyerAnonymizedType(type) && !data.buyerName) return `notifications.anonymous.${type}`
  return `notifications.types.${type}`
}
