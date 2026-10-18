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
