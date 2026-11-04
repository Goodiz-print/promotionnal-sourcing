import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import ConversationService from '#services/conversation_service'
import Conversation from '#models/conversation'
import Message from '#models/message'
import MessageReport from '#models/message_report'
import type User from '#models/user'
import {
  ConversationAccessDeniedException,
  MessageNotFoundException,
  OwnMessageReportException,
} from '#exceptions/messaging_errors'
import {
  MESSAGE_REPORT_NOTE_MAX_LENGTH,
  type MessageReportReason,
} from '#shared/types/conversation'

interface ReportInput {
  reason: MessageReportReason
  details?: string | null
}

/**
 * Signalement d'un message par un participant du fil (#167). Idempotent par
 * signalant : signaler deux fois le même message met à jour le signalement
 * encore ouvert au lieu d'en créer un second.
 */
@inject()
export default class MessageReportService {
  constructor(private conversations: ConversationService) {}

  async report(user: User, messageId: number, input: ReportInput): Promise<MessageReport> {
    const message = await Message.find(messageId)
    if (!message) throw new MessageNotFoundException()

    const conversation = await Conversation.findOrFail(message.conversationId)
    try {
      await this.conversations.assertParticipant(user, conversation)
    } catch (error) {
      // Même réponse qu'un message inexistant : on ne révèle pas l'existence du fil.
      if (error instanceof ConversationAccessDeniedException) throw new MessageNotFoundException()
      throw error
    }
    if (message.authorUserId === user.id) throw new OwnMessageReportException()

    const details = input.details?.trim().slice(0, MESSAGE_REPORT_NOTE_MAX_LENGTH) || null

    return db.transaction(async (trx) => {
      const existing = await MessageReport.query({ client: trx })
        .where('messageId', message.id)
        .where('reporterUserId', user.id)
        .forUpdate()
        .first()

      if (existing) {
        // Un signalement déjà traité n'est pas rouvert : la décision de la plateforme fait foi.
        if (existing.status === 'open') existing.merge({ reason: input.reason, details })
        await existing.save()
        return existing
      }
      return MessageReport.create(
        {
          messageId: message.id,
          reporterUserId: user.id,
          reason: input.reason,
          details,
          status: 'open',
        },
        { client: trx }
      )
    })
  }
}
