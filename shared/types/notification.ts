/**
 * Types de notification in-app. Le type est une chaîne en base (pas un enum
 * SQL) : ajouter un type = ajouter une entrée ici, sans migration. Le `data`
 * porte le contexte (ids, libellés) et doit rester sérialisable en JSON.
 */
export const NOTIFICATION_TYPES = [
  'rfq.received',
  'rfq.responded',
  'rfq.declined',
  'quote.received',
  'quote.accepted',
  'quote.rejected',
  'order.created',
  'order.confirmed',
  'order.in_production',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'organization.invited',
  'organization.member_joined',
  'message.warned',
  'announcement',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/** Types liés aux commandes (#6) : `order.created`, `order.shipped`… */
export type OrderNotificationType = Extract<NotificationType, `order.${string}`>

export interface NotificationData {
  [key: string]: string | number | boolean | null
}

/** Taille de page par défaut de la liste de notifications. */
export const NOTIFICATION_PAGE_SIZE = 20

/** Nombre de notifications listées dans le menu déroulant de la cloche. */
export const NOTIFICATION_DROPDOWN_SIZE = 10

/**
 * Notification telle que l'écran l'affiche. `href` est résolu côté serveur, dans
 * la langue de l'utilisateur : le client n'a pas à connaître les routes de chaque type.
 */
export type NotificationItemType = {
  id: number
  type: NotificationType
  data: NotificationData
  readAt: string | null
  createdAt: string
  href: string
}
