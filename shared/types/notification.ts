/**
 * Types de notification in-app. Le type est une chaîne en base (pas un enum
 * SQL) : ajouter un type = ajouter une entrée ici, sans migration. Le `data`
 * porte le contexte (ids, libellés) et doit rester sérialisable en JSON.
 */
export const NOTIFICATION_TYPES = ['rfq.received', 'rfq.responded', 'organization.invited'] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface NotificationData {
  [key: string]: string | number | boolean | null
}

/** Taille de page par défaut de la liste de notifications. */
export const NOTIFICATION_PAGE_SIZE = 20
