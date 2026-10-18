import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Conversation from '#models/conversation'
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

    return db.transaction(async (trx) => {
      const conversation = await Conversation.create(
        {
          buyerOrganizationId: input.buyerOrganizationId,
          supplierOrganizationId: input.supplierOrganizationId,
          rfqId: input.rfqId ?? null,
          subject: input.subject ?? null,
          createdByUserId: input.author.id,
        },
        { client: trx }
      )
      await Message.create(
        { conversationId: conversation.id, authorUserId: input.author.id, body },
        { client: trx }
      )
      return conversation
    })
  }

  /** Ajoute un message à un fil existant. L'auteur doit être participant. */
  async post(conversation: Conversation, author: User, rawBody: string): Promise<Message> {
    const body = this.normalizeBody(rawBody)
    await this.assertParticipant(author, conversation)
    return Message.create({ conversationId: conversation.id, authorUserId: author.id, body })
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
