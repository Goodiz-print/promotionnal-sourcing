import { BaseTransformer } from '@adonisjs/core/transformers'
import ConversationMessageTransformer from '#transformers/conversation_message_transformer'
import type Conversation from '#models/conversation'
import type RfqSupplier from '#models/rfq_supplier'
import type { RfqThreadType, RfqThreadView } from '#shared/types/conversation'

/**
 * Fil d'une demande pour un destinataire, vu d'un côté (#226). Un destinataire
 * sans fil (aucun échange encore) donne un fil vide, où l'on peut écrire.
 */
export default class RfqThreadTransformer extends BaseTransformer<RfqSupplier> {
  constructor(
    resource: RfqSupplier,
    protected view: RfqThreadView<Conversation>
  ) {
    super(resource)
  }

  toObject(): RfqThreadType {
    const { conversation, viewerSide, counterpartName, canWrite } = this.view
    const blocked = Boolean(conversation?.blockedAt)
    return {
      rfqSupplierId: this.resource.id,
      counterpartName,
      blocked,
      canWrite: canWrite && !blocked,
      messages: (conversation?.messages ?? []).map((message) =>
        new ConversationMessageTransformer(message, viewerSide).toObject()
      ),
    }
  }
}
