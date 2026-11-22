import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import ConversationMessageRecorded from '#events/conversation_message_recorded'
import { RfqSupplierNotFoundException } from '#exceptions/rfq_errors'
import Conversation from '#models/conversation'
import RfqSupplier from '#models/rfq_supplier'
import ConversationService from '#services/conversation_service'
import InboundAddressService from '#services/inbound_address_service'
import { latestMessages } from '#shared/helpers/conversation'
import { THREAD_MESSAGES_LIMIT } from '#shared/types/conversation'
import type Message from '#models/message'
import type Rfq from '#models/rfq'
import type User from '#models/user'
import type {
  ConversationMessageRecordedData,
  LoadedRfqThread,
  PostedMessageInput,
} from '#shared/types/conversation'

/**
 * Fil d'échanges d'une demande pour un destinataire (#226) : un fil par couple
 * demande / fournisseur (`conversations.rfq_supplier_id`), ouvert au premier
 * message, qu'il vienne d'un mail ou de l'application.
 *
 * Écrire passe par `ConversationService#post` ; le message est ensuite annoncé
 * (`ConversationMessageRecorded`) pour être relayé par mail à l'autre côté
 * (`MessageRelayService`).
 */
@inject()
export default class RfqThreadService {
  constructor(
    private conversations: ConversationService,
    private addresses: InboundAddressService
  ) {}

  /**
   * Destinataire d'une demande, avec sa demande : celui de l'agence
   * `buyerOrganizationId`, ou un 404.
   */
  async recipientForBuyer(
    rfqId: number,
    rfqSupplierId: number,
    buyerOrganizationId: number
  ): Promise<RfqSupplier> {
    const recipient = await RfqSupplier.query()
      .where('id', rfqSupplierId)
      .where('rfqId', rfqId)
      .whereHas('rfq', (rfq) => rfq.where('buyerOrganizationId', buyerOrganizationId))
      .preload('rfq')
      .first()
    if (!recipient) throw new RfqSupplierNotFoundException()
    return recipient
  }

  /** Ligne du fournisseur `supplierOrganizationId` pour une demande, ou un 404. */
  async recipientForSupplier(rfqId: number, supplierOrganizationId: number): Promise<RfqSupplier> {
    const recipient = await RfqSupplier.query()
      .where('rfqId', rfqId)
      .where('supplierOrganizationId', supplierOrganizationId)
      .whereNot('status', 'pending')
      .preload('rfq')
      .first()
    if (!recipient) throw new RfqSupplierNotFoundException()
    return recipient
  }

  /**
   * Fils des destinataires, par identifiant de destinataire : pour chacun, ses
   * `THREAD_MESSAGES_LIMIT` derniers messages visibles du plus ancien au plus
   * récent (pièces jointes, auteur, mail d'origine) et s'il en existe de plus
   * anciens. Un destinataire sans fil n'y figure pas.
   */
  async threadsFor(
    rfqSupplierIds: number[]
  ): Promise<Map<number, LoadedRfqThread<Conversation, Message>>> {
    if (rfqSupplierIds.length === 0) return new Map()
    const conversations = await Conversation.query()
      .whereIn('rfqSupplierId', rfqSupplierIds)
      .preload('messages', (messages) => {
        messages
          .whereNull('hiddenAt')
          // Un de plus que la limite : sa présence dit qu'il en reste d'autres.
          .groupLimit(THREAD_MESSAGES_LIMIT + 1)
          .groupOrderBy('created_at', 'desc')
          .groupOrderBy('id', 'desc')
          // L'ordre du groupe ne vaut que pour le classement : celui du résultat se redit.
          .orderBy('createdAt', 'desc')
          .orderBy('id', 'desc')
          .preload('attachments', (attachments) => attachments.orderBy('id'))
          .preload('author', (author) => author.select('id', 'firstName', 'lastName'))
          .preload('inboundMail', (mail) =>
            mail.select('id', 'senderName', 'senderAddress', 'senderKnown')
          )
      })
    return new Map(
      conversations.map((conversation) => [
        conversation.rfqSupplierId!,
        { conversation, ...latestMessages(conversation.messages, THREAD_MESSAGES_LIMIT) },
      ])
    )
  }

  /**
   * Le fil de la demande est-il clos ? Son adresse relais a expiré : on n'y
   * écrit plus, ni par mail ni depuis l'application (`canMessageRfq*`).
   */
  isClosed(rfq: Rfq): boolean {
    return this.addresses.isExpired(rfq)
  }

  /**
   * Écrit dans le fil du destinataire au nom de `message.side`, en ouvrant le
   * fil s'il n'existe pas encore, puis annonce le message pour qu'il soit
   * relayé. `recipient.rfq` doit être chargée. Lève si le fil est bloqué ou
   * si l'auteur n'est pas de ce côté (`ConversationService#post`).
   */
  async post(
    recipient: RfqSupplier,
    author: User,
    message: PostedMessageInput
  ): Promise<ConversationMessageRecordedData> {
    const conversation = await db.transaction(async (trx) => {
      // Verrou du destinataire : un seul fil, même si les deux côtés écrivent ensemble.
      await RfqSupplier.query({ client: trx }).where('id', recipient.id).forUpdate().firstOrFail()
      return this.conversations.threadForRecipient(recipient, trx)
    })
    const posted = await this.conversations.post(conversation, author, message)

    const recorded: ConversationMessageRecordedData = {
      rfqSupplierId: recipient.id,
      conversationId: conversation.id,
      messageId: posted.id,
      side: message.side,
    }
    await this.publish(recorded)
    return recorded
  }

  /**
   * Annonce un message à relayer, **après** le commit : un écouteur défaillant
   * ne doit ni annuler le message ni faire rejouer le mail qui l'a apporté.
   */
  async publish(recorded: ConversationMessageRecordedData): Promise<void> {
    try {
      await emitter.emit(ConversationMessageRecorded, new ConversationMessageRecorded(recorded))
    } catch (error) {
      logger.error({ err: error, ...recorded }, 'conversation message listener failed')
    }
  }
}
