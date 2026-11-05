import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AdminAuditService from '#services/admin_audit_service'
import NotificationService from '#services/notification_service'
import AdminAuditLog from '#models/admin_audit_log'
import Conversation from '#models/conversation'
import Message from '#models/message'
import MessageReport from '#models/message_report'
import {
  AdminMessagingNotFoundException,
  AdminMessagingStateException,
} from '#exceptions/admin_trade_errors'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type {
  AdminConversationBlockOptions,
  AdminMessageActionOptions,
  AdminMessagingActionOptions,
  AdminReportActionOptions,
} from '#shared/types/admin_messaging'
import type { MessageReportResolution } from '#shared/types/conversation'

/**
 * Décisions de modération de la messagerie (#167) : masquer / réafficher un
 * message, avertir son auteur, classer un signalement, bloquer / débloquer un
 * fil. Chaque décision écrit sa trace d'audit **dans la même transaction**.
 * Une action sans objet (déjà masqué, déjà bloqué…) est refusée sans rien écrire.
 */
@inject()
export default class AdminMessagingActionService {
  constructor(
    private audit: AdminAuditService,
    private notifications: NotificationService
  ) {}

  /** Masque le message et clôt ses signalements ouverts (résolution « hidden »). */
  async hideMessage({ messageId, note, context }: AdminMessageActionOptions): Promise<Message> {
    return db.transaction(async (trx) => {
      const message = await this.lockMessage(messageId, trx)
      if (message.hiddenAt) throw new AdminMessagingStateException()

      message.merge({ hiddenAt: DateTime.now(), hiddenByUserId: context.actor?.id ?? null })
      await message.save()
      await this.resolveOpenReports(message.id, 'hidden', note, context, trx)
      await this.audit.record(
        {
          action: 'message.hidden',
          targetType: 'message',
          targetId: message.id,
          changes: { before: { hidden: false }, after: { hidden: true } },
        },
        { ...context, client: trx }
      )
      return message
    })
  }

  /** Réaffiche un message masqué ; ses signalements restent traités. */
  async unhideMessage({ messageId, context }: AdminMessageActionOptions): Promise<Message> {
    return db.transaction(async (trx) => {
      const message = await this.lockMessage(messageId, trx)
      if (!message.hiddenAt) throw new AdminMessagingStateException()

      message.merge({ hiddenAt: null, hiddenByUserId: null })
      await message.save()
      await this.audit.record(
        {
          action: 'message.unhidden',
          targetType: 'message',
          targetId: message.id,
          changes: { before: { hidden: true }, after: { hidden: false } },
        },
        { ...context, client: trx }
      )
      return message
    })
  }

  /**
   * Avertit l'auteur (notification in-app) et clôt les signalements ouverts du
   * message (résolution « warned »). Un message sans auteur connu ne peut pas
   * être suivi d'un avertissement.
   */
  async warnAuthor({ messageId, note, context }: AdminMessageActionOptions): Promise<Message> {
    const message = await db.transaction(async (trx) => {
      const locked = await this.lockMessage(messageId, trx)
      if (!locked.authorUserId) throw new AdminMessagingStateException()
      // Un seul avertissement par message : sinon l'action est rejouable à l'infini.
      const warned = await AdminAuditLog.query({ client: trx })
        .where('action', 'message.warned')
        .where('target_type', 'message')
        .where('target_id', locked.id)
        .first()
      if (warned) throw new AdminMessagingStateException()

      await this.resolveOpenReports(locked.id, 'warned', note, context, trx)
      await this.audit.record(
        { action: 'message.warned', targetType: 'message', targetId: locked.id },
        { ...context, client: trx }
      )
      return locked
    })

    // Canal secondaire, hors transaction : l'avertissement est déjà tracé.
    try {
      await this.notifications.notify({ id: message.authorUserId! }, 'message.warned', {
        conversationId: message.conversationId,
      })
    } catch (error) {
      logger.error({ err: error, messageId: message.id }, 'message warning notification failed')
    }
    return message
  }

  /** Classe un signalement sans suite. */
  async dismissReport({
    reportId,
    note,
    context,
  }: AdminReportActionOptions): Promise<MessageReport> {
    return db.transaction(async (trx) => {
      const report = await MessageReport.query({ client: trx })
        .where('id', reportId)
        .forUpdate()
        .first()
      if (!report) throw new AdminMessagingNotFoundException()
      if (report.status !== 'open') throw new AdminMessagingStateException()

      this.close(report, 'dismissed', note, context)
      await report.save()
      await this.audit.record(
        { action: 'message_report.dismissed', targetType: 'message_report', targetId: report.id },
        { ...context, client: trx }
      )
      return report
    })
  }

  async blockConversation({
    conversationId,
    reason,
    context,
  }: AdminConversationBlockOptions): Promise<Conversation> {
    return db.transaction(async (trx) => {
      const conversation = await this.lockConversation(conversationId, trx)
      if (conversation.blockedAt) throw new AdminMessagingStateException()

      conversation.merge({
        blockedAt: DateTime.now(),
        blockedReason: reason,
        blockedByUserId: context.actor?.id ?? null,
      })
      await conversation.save()
      await this.audit.record(
        {
          action: 'conversation.blocked',
          targetType: 'conversation',
          targetId: conversation.id,
          changes: { before: { blocked: false }, after: { blocked: true, reason } },
        },
        { ...context, client: trx }
      )
      return conversation
    })
  }

  async unblockConversation({
    conversationId,
    context,
  }: AdminMessagingActionOptions & { conversationId: number }): Promise<Conversation> {
    return db.transaction(async (trx) => {
      const conversation = await this.lockConversation(conversationId, trx)
      if (!conversation.blockedAt) throw new AdminMessagingStateException()

      conversation.merge({ blockedAt: null, blockedReason: null, blockedByUserId: null })
      await conversation.save()
      await this.audit.record(
        {
          action: 'conversation.unblocked',
          targetType: 'conversation',
          targetId: conversation.id,
          changes: { before: { blocked: true }, after: { blocked: false } },
        },
        { ...context, client: trx }
      )
      return conversation
    })
  }

  private async lockMessage(id: number, trx: TransactionClientContract): Promise<Message> {
    const message = await Message.query({ client: trx }).where('id', id).forUpdate().first()
    if (!message) throw new AdminMessagingNotFoundException()
    return message
  }

  private async lockConversation(
    id: number,
    trx: TransactionClientContract
  ): Promise<Conversation> {
    const conversation = await Conversation.query({ client: trx })
      .where('id', id)
      .forUpdate()
      .first()
    if (!conversation) throw new AdminMessagingNotFoundException()
    return conversation
  }

  /** Clôt tous les signalements encore ouverts du message avec la même résolution. */
  private async resolveOpenReports(
    messageId: number,
    resolution: MessageReportResolution,
    note: string | null | undefined,
    context: AdminActionContext,
    trx: TransactionClientContract
  ): Promise<void> {
    const reports = await MessageReport.query({ client: trx })
      .where('messageId', messageId)
      .where('status', 'open')
      .forUpdate()
    for (const report of reports) {
      this.close(report, resolution, note, context)
      await report.save()
    }
  }

  private close(
    report: MessageReport,
    resolution: MessageReportResolution,
    note: string | null | undefined,
    context: AdminActionContext
  ): void {
    report.merge({
      status: 'resolved',
      resolution,
      resolutionNote: note?.trim() || null,
      handledByUserId: context.actor?.id ?? null,
      handledAt: DateTime.now(),
    })
  }
}
