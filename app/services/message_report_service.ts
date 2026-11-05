import { inject } from '@adonisjs/core'
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
/** Violation d'unicité PostgreSQL (SQLSTATE 23505). */
const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'

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

    const existing = await this.findOwn(message.id, user.id)
    if (existing) return this.refresh(existing, input.reason, details)

    try {
      return await MessageReport.create({
        messageId: message.id,
        reporterUserId: user.id,
        reason: input.reason,
        details,
        status: 'open',
      })
    } catch (error) {
      // Deux premiers signalements simultanés du même utilisateur : l'unicité
      // (message, signalant) départage, le perdant retombe sur le gagnant.
      if (!isUniqueViolation(error)) throw error
      return this.refresh(await this.findOwn(message.id, user.id, true), input.reason, details)
    }
  }

  private findOwn(messageId: number, userId: number): Promise<MessageReport | null>
  private findOwn(messageId: number, userId: number, required: true): Promise<MessageReport>
  private findOwn(messageId: number, userId: number, required = false) {
    const query = MessageReport.query()
      .where('messageId', messageId)
      .where('reporterUserId', userId)
    return required ? query.firstOrFail() : query.first()
  }

  /** Un signalement déjà traité n'est pas rouvert : la décision de la plateforme fait foi. */
  private async refresh(
    report: MessageReport,
    reason: MessageReportReason,
    details: string | null
  ): Promise<MessageReport> {
    if (report.status !== 'open') return report
    report.merge({ reason, details })
    await report.save()
    return report
  }
}
