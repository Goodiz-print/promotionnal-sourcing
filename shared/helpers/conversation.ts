import type {
  ConversationSide,
  PostedMessageInput,
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
