import { DateTime } from 'luxon'
import factory from '@adonisjs/lucid/factories'
import ConversationRead from '#models/conversation_read'

/**
 * Lecture d'un fil. `conversationId` et `userId` sont à fournir par l'appelant.
 */
export const ConversationReadFactory = factory
  .define(ConversationRead, () => ({
    lastReadMessageId: null,
    readAt: DateTime.now(),
  }))
  .build()
