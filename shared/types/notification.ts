import type { PlatformRole } from './user.js'

/**
 * Types de notification in-app. Le type est une chaîne en base (pas un enum
 * SQL) : ajouter un type = ajouter une entrée ici, sans migration. Le `data`
 * porte le contexte (ids, libellés) et doit rester sérialisable en JSON.
 */
export const NOTIFICATION_TYPES = [
  'rfq.received',
  'rfq.responded',
  'rfq.declined',
  /** Un mail de l'agence n'a pas été relayé : expéditeur non reconnu (#226). */
  'rfq.relay_refused',
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
  'subscription.duplicate_cancelled',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/** Types liés aux commandes (#6) : `order.created`, `order.shipped`… */
export type OrderNotificationType = Extract<NotificationType, `order.${string}`>

/**
 * Types dont le texte nomme l'agence et qui partent chez un fournisseur : pour
 * un fournisseur non abonné, `buyerName` est absent des données (#220) et le
 * texte vient de `notifications.anonymous.<type>` (cf. `notificationMessageKey`).
 */
export const BUYER_ANONYMIZED_NOTIFICATION_TYPES = [
  'rfq.received',
  'quote.rejected',
] as const satisfies readonly NotificationType[]

export type BuyerAnonymizedNotificationType = (typeof BUYER_ANONYMIZED_NOTIFICATION_TYPES)[number]

export interface NotificationData {
  [key: string]: string | number | boolean | null
}

/**
 * Données d'une notification liée à un message du fil : une seule par
 * utilisateur, type et `messageId` (`NotificationService#notifyOncePerMessage`).
 */
export interface MessageNotificationData extends NotificationData {
  messageId: number
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

/** Politique de rappel par mail d'un type de notification (#243). */
export interface NotificationEmailFallbackPolicy {
  /** Délai (minutes) après la création au-delà duquel une notification non lue déclenche le mail. */
  delayMinutes: number
  /**
   * Rôle plateforme que le destinataire doit **encore** avoir au moment du rappel
   * (alerte réservée à l'équipe plateforme). Un utilisateur rétrogradé entre-temps
   * ne reçoit pas de mail menant à un écran qui lui est désormais refusé.
   */
  recipientPlatformRole?: PlatformRole
}

/**
 * Âge maximal (heures) d'une notification pour son rappel : au-delà, plus aucun
 * mail ne part. Évite, au déploiement d'une politique, une rafale de rappels pour
 * des notifications anciennes, et borne la sélection du job.
 */
export const NOTIFICATION_REMINDER_MAX_AGE_HOURS = 7 * 24

/** Délai (minutes) de rappel des notifications destinées aux acheteurs et fournisseurs. */
const BUSINESS_REMINDER_DELAY_MINUTES = 24 * 60

/**
 * Types « à rappeler » : une notification de ces types encore non lue après
 * `delayMinutes` déclenche **un seul** mail de rappel vers son destinataire.
 * Un type absent de cette table n'envoie jamais de mail. Les types qui ont déjà
 * leur propre mail à la création (`rfq.received`, `quote.received`, `announcement`,
 * invitation) n'y figurent pas : le rappel ferait doublon.
 */
export const NOTIFICATION_EMAIL_FALLBACK: Partial<
  Record<NotificationType, NotificationEmailFallbackPolicy>
> = {
  'subscription.duplicate_cancelled': { delayMinutes: 30, recipientPlatformRole: 'admin' },
  'order.created': { delayMinutes: BUSINESS_REMINDER_DELAY_MINUTES },
  'order.confirmed': { delayMinutes: BUSINESS_REMINDER_DELAY_MINUTES },
  'order.in_production': { delayMinutes: BUSINESS_REMINDER_DELAY_MINUTES },
  'order.shipped': { delayMinutes: BUSINESS_REMINDER_DELAY_MINUTES },
  'order.cancelled': { delayMinutes: BUSINESS_REMINDER_DELAY_MINUTES },
  'quote.accepted': { delayMinutes: BUSINESS_REMINDER_DELAY_MINUTES },
  'quote.rejected': { delayMinutes: BUSINESS_REMINDER_DELAY_MINUTES },
  'rfq.declined': { delayMinutes: BUSINESS_REMINDER_DELAY_MINUTES },
  'message.warned': { delayMinutes: BUSINESS_REMINDER_DELAY_MINUTES },
}
