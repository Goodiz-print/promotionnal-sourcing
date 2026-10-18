import transmit from '@adonisjs/transmit/services/main'
import app from '@adonisjs/core/services/app'
import { REALTIME_CHANNELS } from '#shared/types/realtime'
import RealtimeService from '#services/realtime_service'

/**
 * Autorisation des canaux privés (#57, #8). Chaque callback délègue à
 * `RealtimeService`, qui contient les règles (propriétaire, membre du fil).
 */
transmit.authorize<{ userId: string }>(
  REALTIME_CHANNELS.userNotifications,
  async (ctx, { userId }) => {
    const realtime = await app.container.make(RealtimeService)
    return realtime.canSubscribeToUser(ctx.auth.user, Number(userId))
  }
)

transmit.authorize<{ conversationId: string }>(
  REALTIME_CHANNELS.conversation,
  async (ctx, { conversationId }) => {
    const realtime = await app.container.make(RealtimeService)
    return realtime.canSubscribeToConversation(ctx.auth.user, Number(conversationId))
  }
)
