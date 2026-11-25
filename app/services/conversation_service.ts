import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Conversation from '#models/conversation'
import ConversationRead from '#models/conversation_read'
import RealtimeService from '#services/realtime_service'
import Message from '#models/message'
import MessageAttachment from '#models/message_attachment'
import type RfqSupplier from '#models/rfq_supplier'
import OrganizationUser from '#models/organization_user'
import User from '#models/user'
import {
  ConversationAccessDeniedException,
  ConversationBlockedException,
  InvalidMessageBodyException,
} from '#exceptions/messaging_errors'
import {
  conversationSidesOf,
  postedMessageFor,
  type ConversationParties,
} from '#shared/helpers/conversation'
import {
  MESSAGE_MAX_LENGTH,
  type InboundMessageInput,
  type MessageAttachmentInput,
  type PostedMessageInput,
  type UploadedMessageInput,
} from '#shared/types/conversation'

/** Longueur de `conversations.subject`. */
const SUBJECT_MAX = 180

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
    const [senderSide] = await this.sidesOfMember(input.author, input)
    if (!senderSide) throw new ConversationAccessDeniedException()

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
        { conversationId: created.id, authorUserId: input.author.id, body, senderSide },
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

  /**
   * Ajoute un message à un fil existant. L'auteur doit être participant.
   * `message` est le texte seul — le côté se déduit alors de l'adhésion de
   * l'auteur, l'agence d'abord — ou le texte et le côté au nom duquel il écrit
   * (#226 : l'écran d'une demande sait de quel côté il est), qui doit être
   * l'un des siens.
   */
  async post(
    conversation: Conversation,
    author: User,
    message: string | PostedMessageInput
  ): Promise<Message> {
    const posted = postedMessageFor(message, await this.sidesOfMember(author, conversation))
    if (!posted) throw new ConversationAccessDeniedException()
    const body = this.normalizeBody(posted.body)
    // Fil bloqué par la plateforme (#167) : la lecture reste possible, l'écriture non.
    if (conversation.blockedAt) throw new ConversationBlockedException()
    const created = await Message.create({
      conversationId: conversation.id,
      authorUserId: author.id,
      body,
      senderSide: posted.side,
    })
    this.realtime.messagePosted(conversation.id, {
      type: 'message.posted',
      messageId: created.id,
      authorUserId: author.id,
    })
    return created
  }

  // ── Réponses reçues par mail (#224) ─────────────────────────────────────

  /**
   * Fil d'une demande pour un destinataire : retrouvé par `rfq_supplier_id`,
   * ouvert à la première réponse. À appeler dans une transaction qui tient le
   * verrou du destinataire (un seul fil par destinataire). `recipient.rfq` doit
   * être chargée.
   */
  async threadForRecipient(
    recipient: RfqSupplier,
    trx: TransactionClientContract
  ): Promise<Conversation> {
    const existing = await Conversation.query({ client: trx })
      .where('rfqSupplierId', recipient.id)
      .first()
    if (existing) return existing

    return Conversation.create(
      {
        buyerOrganizationId: recipient.rfq.buyerOrganizationId,
        supplierOrganizationId: recipient.supplierOrganizationId,
        rfqId: recipient.rfqId,
        rfqSupplierId: recipient.id,
        subject: recipient.rfq.title.slice(0, SUBJECT_MAX),
        createdByUserId: null,
      },
      { client: trx }
    )
  }

  /**
   * Écrit le message né d'un mail entrant, avec ses pièces jointes (fichiers
   * déjà sur Cellar). Sans auteur : l'expéditeur est celui du mail. Un fil
   * bloqué par la plateforme le reçoit quand même — c'est une réception, pas
   * une écriture d'un participant, et la réponse ne doit pas se perdre.
   * Renvoie le message, `attachments` chargées.
   */
  async recordInbound(
    conversation: Conversation,
    input: InboundMessageInput,
    trx: TransactionClientContract
  ): Promise<Message> {
    const message = await Message.create(
      {
        conversationId: conversation.id,
        authorUserId: null,
        inboundMailId: input.inboundMailId,
        body: input.body,
        senderSide: input.senderSide,
      },
      { client: trx }
    )
    return this.attach(message, input.attachments, trx)
  }

  /**
   * Écrit le message d'un participant qui joint des fichiers depuis
   * l'application — le devis PDF qu'un fournisseur dépose depuis une demande
   * reçue (#230). Fichiers déjà sur Cellar, écriture dans la transaction de
   * l'appelant. Contrairement à `recordInbound`, c'est l'écriture d'un
   * participant : un fil bloqué par la plateforme (#167) la refuse. Renvoie le
   * message, `attachments` chargées.
   */
  async recordUploaded(
    conversation: Conversation,
    input: UploadedMessageInput,
    trx: TransactionClientContract
  ): Promise<Message> {
    if (conversation.blockedAt) throw new ConversationBlockedException()
    const message = await Message.create(
      {
        conversationId: conversation.id,
        authorUserId: input.authorUserId,
        body: input.body,
        senderSide: input.senderSide,
      },
      { client: trx }
    )
    return this.attach(message, input.attachments, trx)
  }

  /** Message déjà né de ce mail, s'il existe (garde d'idempotence). */
  findInboundMessage(
    inboundMailId: number,
    trx?: TransactionClientContract
  ): Promise<Message | null> {
    return Message.query({ client: trx }).where('inboundMailId', inboundMailId).first()
  }

  /** Diffuse en temps réel un message né d'un mail — après le commit. */
  announce(conversationId: number, messageId: number): void {
    this.realtime.messagePosted(conversationId, {
      type: 'message.posted',
      messageId,
      authorUserId: null,
    })
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

  /**
   * Messages d'un fil visibles par les participants, du plus ancien au plus
   * récent. Un message masqué par la plateforme (#167) n'est jamais renvoyé :
   * seule la modération le lit encore (`AdminMessagingService`).
   */
  messagesOf(conversation: Conversation) {
    return Message.query()
      .where('conversationId', conversation.id)
      .whereNull('hiddenAt')
      .orderBy('createdAt', 'asc')
      .orderBy('id', 'asc')
  }

  /** Côtés au nom desquels `user` peut écrire dans un fil entre ces deux organisations. */
  private async sidesOfMember(user: User, parties: ConversationParties) {
    const memberships = await OrganizationUser.query()
      .where('userId', user.id)
      .whereIn('organizationId', [parties.buyerOrganizationId, parties.supplierOrganizationId])
      .select('organizationId')
    return conversationSidesOf(
      memberships.map(({ organizationId }) => organizationId),
      parties
    )
  }

  private async assertMemberOf(user: User, organizationIds: number[]): Promise<void> {
    const membership = await OrganizationUser.query()
      .where('userId', user.id)
      .whereIn('organizationId', organizationIds)
      .first()
    if (!membership) throw new ConversationAccessDeniedException()
  }

  /** Rattache au message ses pièces jointes (fichiers déjà sur Cellar) et les charge. */
  private async attach(
    message: Message,
    inputs: MessageAttachmentInput[],
    trx: TransactionClientContract
  ): Promise<Message> {
    const attachments = await MessageAttachment.createMany(
      inputs.map(({ storageObjectId, filename, mimeType, sizeBytes }) => ({
        messageId: message.id,
        storageObjectId,
        filename,
        mimeType,
        sizeBytes,
      })),
      { client: trx }
    )
    message.$setRelated('attachments', attachments)
    return message
  }

  private normalizeBody(raw: string): string {
    const body = raw.trim()
    if (body.length === 0 || body.length > MESSAGE_MAX_LENGTH) {
      throw new InvalidMessageBodyException()
    }
    return body
  }
}
