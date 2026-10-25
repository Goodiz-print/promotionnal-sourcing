/**
 * Noms des canaux temps réel (Transmit). Source unique : le serveur les diffuse
 * et les autorise avec les mêmes gabarits que ceux utilisés côté client.
 */
export const REALTIME_CHANNELS = {
  userNotifications: 'notifications/users/:userId',
  conversation: 'conversations/:conversationId',
} as const

export const userNotificationsChannel = (userId: number) => `notifications/users/${userId}`

export const conversationChannel = (conversationId: number) => `conversations/${conversationId}`

/** Événements diffusés sur les canaux. `type` permet au client de réagir sans deviner. */
export type RealtimeEvent =
  | { type: 'notification.created'; notificationId: number; notificationType: string }
  | { type: 'message.posted'; messageId: number; authorUserId: number | null }

/** Canal PostgreSQL unique (`LISTEN` / `NOTIFY`) du transport Transmit partagé. */
export const TRANSMIT_PG_CHANNEL = 'transmit_bus'

/** `NOTIFY` plafonne la charge à 8 000 octets ; marge pour l'encodage. */
export const TRANSMIT_PG_MAX_PAYLOAD_BYTES = 7900

/** Enveloppe d'un message Transmit sur `TRANSMIT_PG_CHANNEL`. */
export interface TransmitEnvelope {
  /** Canal Transmit (ex. `notifications/users/12`), routé localement par chaque instance. */
  channel: string
  /** Instance émettrice, pour ne pas se rejouer ses propres messages. */
  busId: string
  payload: unknown
}

/** Transports Transmit : `memory` (une instance), `postgres` (plusieurs instances web). */
export const TRANSMIT_TRANSPORTS = ['memory', 'postgres'] as const

export type TransmitTransportName = (typeof TRANSMIT_TRANSPORTS)[number]
