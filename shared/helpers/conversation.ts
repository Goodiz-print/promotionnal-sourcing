import type { DateTime } from 'luxon'
import { isRelayWindowClosed } from './inbound_mail.js'
import type {
  ConversationMailSenderType,
  ConversationMessageType,
  ConversationSide,
  MessageSenderLabels,
  PostedMessageInput,
  RfqThreadState,
  ThreadMessagesWindow,
} from '../types/conversation.js'

/** Organisations d'un fil : l'acheteuse (l'agence) et la fournisseuse. */
export interface ConversationParties {
  buyerOrganizationId: number
  supplierOrganizationId: number
}

/**
 * Côtés d'un fil au nom desquels peut écrire un membre des organisations
 * `organizationIds` (#226), l'agence d'abord. Vide s'il n'est membre d'aucune.
 */
export function conversationSidesOf(
  organizationIds: number[],
  parties: ConversationParties
): ConversationSide[] {
  const sides: Array<[ConversationSide, number]> = [
    ['agency', parties.buyerOrganizationId],
    ['supplier', parties.supplierOrganizationId],
  ]
  return sides.filter(([, id]) => organizationIds.includes(id)).map(([side]) => side)
}

/**
 * Message à écrire, avec le côté au nom duquel l'auteur écrit : le côté
 * explicite s'il fait partie de ceux de l'auteur, sinon (texte seul) son
 * premier côté. `null` si l'auteur ne peut pas écrire de ce côté.
 */
export function postedMessageFor(
  message: string | PostedMessageInput,
  sides: ConversationSide[]
): PostedMessageInput | null {
  const posted = typeof message === 'string' ? { body: message, side: sides[0] } : message
  return posted.side && sides.includes(posted.side) ? posted : null
}

/**
 * Derniers messages d'un fil à afficher (#226), à partir de messages lus **du
 * plus récent au plus ancien** à raison de `limit + 1` au plus : remis dans
 * l'ordre de lecture, avec `hasOlder` si le message en trop prouve qu'il en
 * existe de plus anciens.
 */
export function latestMessages<M>(newestFirst: M[], limit: number): ThreadMessagesWindow<M> {
  return {
    messages: newestFirst.slice(0, limit).reverse(),
    hasOlder: newestFirst.length > limit,
  }
}

/**
 * Le fil d'un destinataire est-il ouvert à l'écriture (#226) ? Le destinataire
 * appartient à la demande, elle lui a été envoyée (un destinataire `pending`
 * n'a pas encore de fil), et l'adresse relais n'a pas expiré
 * (`isRelayWindowClosed`) : la même fenêtre que les réponses par mail, pour
 * que l'écran et la messagerie ne se contredisent jamais.
 */
export function isRfqThreadOpen(state: RfqThreadState, graceDays: number, now: DateTime): boolean {
  const { rfq, recipient } = state
  if (recipient.rfqId !== rfq.id || recipient.status === 'pending') return false
  return !isRelayWindowClosed(rfq, graceDays, now)
}

/** Expéditeur d'un mail affiché : `Nom <adresse>`, ou l'adresse seule. */
export function mailSenderLabel(mail: ConversationMailSenderType): string {
  return mail.name ? `${mail.name} <${mail.address}>` : mail.address
}

/**
 * Qui a écrit un message, vu de celui qui le lit : l'autre côté par son
 * libellé, son propre côté par le nom de l'auteur, à défaut « votre équipe »
 * (un mail de son propre côté n'a pas d'auteur).
 */
export function messageSenderLabel(
  message: Pick<ConversationMessageType, 'mine' | 'authorName'>,
  labels: MessageSenderLabels
): string {
  if (!message.mine) return labels.counterpart
  return message.authorName ?? labels.yourTeam
}
