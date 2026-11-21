import type { ConversationMessageRecordedData } from '#shared/types/conversation'

/**
 * Un message vient d'entrer dans le fil d'une demande et doit être relayé par
 * mail à l'autre côté (#226) : un message écrit dans l'application (agence ou
 * fournisseur) ou un mail de l'agence. Émis après le commit.
 */
export default class ConversationMessageRecorded {
  constructor(public message: ConversationMessageRecordedData) {}
}
