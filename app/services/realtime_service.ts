import { inject } from '@adonisjs/core'
import transmit from '@adonisjs/transmit/services/main'
import Conversation from '#models/conversation'
import OrganizationUser from '#models/organization_user'
import User from '#models/user'
import {
  conversationChannel,
  userNotificationsChannel,
  type RealtimeEvent,
} from '#shared/types/realtime'

/**
 * Diffusion et autorisation temps réel (#57, #8). Seule couche qui parle à
 * Transmit : les services métier l'appellent, les tests le remplacent.
 *
 * La diffusion ne concerne que les processus web connectés à Transmit. Le
 * transport est en mémoire (`config/transmit.ts`) : avec plusieurs instances web,
 * il faudra un transport partagé (cf. docs/entites-transverses.md).
 */
@inject()
export default class RealtimeService {
  notifyUser(
    userId: number,
    event: Extract<RealtimeEvent, { type: 'notification.created' }>
  ): void {
    transmit.broadcast(userNotificationsChannel(userId), event)
  }

  messagePosted(
    conversationId: number,
    event: Extract<RealtimeEvent, { type: 'message.posted' }>
  ): void {
    transmit.broadcast(conversationChannel(conversationId), event)
  }

  /** Un utilisateur ne reçoit que ses propres notifications. */
  canSubscribeToUser(user: Pick<User, 'id'> | undefined, userId: number): boolean {
    return user !== undefined && user.id === userId
  }

  /** Seuls les membres de l'une des deux organisations du fil peuvent s'y abonner. */
  async canSubscribeToConversation(
    user: Pick<User, 'id'> | undefined,
    conversationId: number
  ): Promise<boolean> {
    if (!user) return false
    const conversation = await Conversation.find(conversationId)
    if (!conversation) return false
    const membership = await OrganizationUser.query()
      .where('userId', user.id)
      .whereIn('organizationId', [
        conversation.buyerOrganizationId,
        conversation.supplierOrganizationId,
      ])
      .first()
    return membership !== null
  }
}
