import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import Conversation from '#models/conversation'
import ConversationRead from '#models/conversation_read'
import RealtimeService from '#services/realtime_service'
import Message from '#models/message'
import OrganizationUser from '#models/organization_user'
import User from '#models/user'
import {
  ConversationAccessDeniedException,
  InvalidMessageBodyException,
} from '#exceptions/messaging_errors'
import { MESSAGE_MAX_LENGTH } from '#shared/types/conversation'

interface StartInput {
  buyerOrganizationId: number
  supplierOrganizationId: number
  author: User
  body: string
  rfqId?: number | null
  subject?: string | null
}

/**
 * Messagerie acheteur ↔ fournisseur (#8). Un fil appartient à deux
 * organisations ; seuls les membres de l'une ou l'autre peuvent y écrire.
 *
 * Le suivi de lecture par participant n'existe pas encore : il s'ajoutera sans
 * modifier `messages`.
 */
@inject()
export default class ConversationService {
  constructor(private realtime: RealtimeService) {}

  /**
   * Ouvre un fil et écrit son premier message, dans une seule transaction.
   * L'auteur doit être membre de l'organisation acheteuse ou fournisseuse.
   */
  async start(input: StartInput): Promise<Conversation> {
    const body = this.normalizeBody(input.body)
    await this.assertMemberOf(input.author, [
      input.buyerOrganizationId,
      input.supplierOrganizationId,
    ])

    const conversation = await db.transaction(async (trx) => {
      const created = await Conversation.create(
        {
          buyerOrganizationId: input.buyerOrganizationId,
          supplierOrganizationId: input.supplierOrganizationId,
          rfqId: input.rfqId ?? null,
          subject: input.subject ?? null,
          createdByUserId: input.author.id,
        },
        { client: trx }
      )
      const message = await Message.create(
        { conversationId: created.id, authorUserId: input.author.id, body },
        { client: trx }
      )
      this.realtime.messagePosted(created.id, {
        type: 'message.posted',
        messageId: message.id,
        authorUserId: input.author.id,
      })
      return created
    })
    return conversation
  }

  /** Ajoute un message à un fil existant. L'auteur doit être participant. */
  async post(conversation: Conversation, author: User, rawBody: string): Promise<Message> {
    const body = this.normalizeBody(rawBody)
    await this.assertParticipant(author, conversation)
    const message = await Message.create({
      conversationId: conversation.id,
      authorUserId: author.id,
      body,
    })
    this.realtime.messagePosted(conversation.id, {
      type: 'message.posted',
      messageId: message.id,
      authorUserId: author.id,
    })
    return message
  }

  /**
   * Marque le fil comme lu jusqu'à son dernier message. Idempotent. Un fil sans
   * message ne crée pas de lecture.
   */
  async markRead(conversation: Conversation, user: User): Promise<void> {
    await this.assertParticipant(user, conversation)
    const latest = await Message.query()
      .where('conversationId', conversation.id)
      .orderBy('id', 'desc')
      .first()
    if (!latest) return

    const existing = await ConversationRead.query()
      .where('conversationId', conversation.id)
      .where('userId', user.id)
      .first()
    if (existing) {
      existing.merge({ lastReadMessageId: latest.id, readAt: DateTime.now() })
      await existing.save()
      return
    }
    await ConversationRead.create({
      conversationId: conversation.id,
      userId: user.id,
      lastReadMessageId: latest.id,
      readAt: DateTime.now(),
    })
  }

  /**
   * Messages non lus pour `user` : ceux postés après sa dernière lecture, par
   * d'autres que lui. Sans lecture enregistrée, tous les messages d'autrui comptent.
   */
  async unreadCount(conversation: Conversation, user: User): Promise<number> {
    await this.assertParticipant(user, conversation)
    const read = await ConversationRead.query()
      .where('conversationId', conversation.id)
      .where('userId', user.id)
      .first()

    const row = await Message.query()
      .where('conversationId', conversation.id)
      .where((other) => {
        other.whereNull('authorUserId').orWhere('authorUserId', '!=', user.id)
      })
      .if(read?.lastReadMessageId, (query) => query.where('id', '>', read!.lastReadMessageId!))
      .count('* as total')
      .first()
    return Number(row?.$extras.total ?? 0)
  }

  /** Vérifie que `user` est membre de l'une des deux organisations du fil. */
  async assertParticipant(user: User, conversation: Conversation): Promise<void> {
    await this.assertMemberOf(user, [
      conversation.buyerOrganizationId,
      conversation.supplierOrganizationId,
    ])
  }

  /** Messages d'un fil, du plus ancien au plus récent. */
  messagesOf(conversation: Conversation) {
    return Message.query()
      .where('conversationId', conversation.id)
      .orderBy('createdAt', 'asc')
      .orderBy('id', 'asc')
  }

  private async assertMemberOf(user: User, organizationIds: number[]): Promise<void> {
    const membership = await OrganizationUser.query()
      .where('userId', user.id)
      .whereIn('organizationId', organizationIds)
      .first()
    if (!membership) throw new ConversationAccessDeniedException()
  }

  private normalizeBody(raw: string): string {
    const body = raw.trim()
    if (body.length === 0 || body.length > MESSAGE_MAX_LENGTH) {
      throw new InvalidMessageBodyException()
    }
    return body
  }
}
