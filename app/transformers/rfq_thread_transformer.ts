import { BaseTransformer } from '@adonisjs/core/transformers'
import ConversationMessageTransformer from '#transformers/conversation_message_transformer'
import type Conversation from '#models/conversation'
import type Message from '#models/message'
import type RfqSupplier from '#models/rfq_supplier'
import type { RfqThreadType, RfqThreadView } from '#shared/types/conversation'

/**
 * Fil d'une demande pour un destinataire, vu d'un côté (#226). Un destinataire
 * sans fil (aucun échange encore) donne un fil vide, où l'on peut écrire tant
 * qu'il n'est ni bloqué ni clos.
 */
export default class RfqThreadTransformer extends BaseTransformer<RfqSupplier> {
  constructor(
    resource: RfqSupplier,
    protected view: RfqThreadView<Conversation, Message>
  ) {
    super(resource)
  }

  toObject(): RfqThreadType {
    const { thread, viewerSide, counterpartName, canWrite, closed } = this.view
    const blocked = Boolean(thread?.conversation.blockedAt)
    return {
      rfqSupplierId: this.resource.id,
      counterpartName,
      blocked,
      closed,
      canWrite: canWrite && !blocked && !closed,
      hasOlder: thread?.hasOlder ?? false,
      messages: (thread?.messages ?? []).map((message) =>
        new ConversationMessageTransformer(message, viewerSide).toObject()
      ),
    }
  }
}
