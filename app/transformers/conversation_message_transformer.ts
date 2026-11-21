import { BaseTransformer } from '@adonisjs/core/transformers'
import type Message from '#models/message'
import type {
  ConversationMailSenderType,
  ConversationMessageType,
  ConversationSide,
} from '#shared/types/conversation'

/**
 * Message d'un fil vu d'un côté (#226). L'auteur n'est nommé que pour un
 * message de son propre côté : un fournisseur non abonné ne doit pas lire le
 * nom d'un membre de l'agence (#220), et l'autre côté est nommé par le fil.
 * Suppose `attachments` préchargées, `author` pour un message écrit dans
 * l'application et `inboundMail` pour un message né d'un mail
 * (`RfqThreadService#threadsFor`).
 */
export default class ConversationMessageTransformer extends BaseTransformer<Message> {
  constructor(
    resource: Message,
    protected viewerSide: ConversationSide
  ) {
    super(resource)
  }

  toObject(): ConversationMessageType {
    const message = this.resource
    const mine = message.senderSide === this.viewerSide
    return {
      id: message.id,
      body: message.body,
      side: message.senderSide,
      mine,
      authorName: mine ? (message.author?.fullName ?? null) : null,
      viaMail: message.inboundMailId !== null,
      mailSender: this.mailSender,
      createdAt: message.createdAt.toISO() ?? '',
      attachments: message.attachments.map(({ id, filename }) => ({ id, filename })),
    }
  }

  /**
   * Expéditeur du mail d'origine, s'il est chargé. Un mail de l'agence n'est
   * jamais décrit au fournisseur : son adresse révélerait l'agence.
   */
  protected get mailSender(): ConversationMailSenderType | null {
    const mail = this.resource.inboundMail
    const hidesAgency = this.viewerSide === 'supplier' && this.resource.senderSide === 'agency'
    if (!mail || hidesAgency) return null
    return { name: mail.senderName, address: mail.senderAddress, known: mail.senderKnown ?? false }
  }
}
