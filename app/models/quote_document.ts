import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { QuoteDocumentSchema } from '#database/schema'
import Message from '#models/message'
import MessageAttachment from '#models/message_attachment'
import Rfq from '#models/rfq'
import RfqSupplier from '#models/rfq_supplier'

/**
 * Devis du fournisseur reçu en PDF (#224), à côté du devis structuré (`Quote`).
 * Rattaché au destinataire de la demande ; son fichier est la pièce jointe du
 * message qui l'a apporté. Le plus récent fait foi (`QuoteService`).
 */
export default class QuoteDocument extends QuoteDocumentSchema {
  static table = 'quote_documents'

  @belongsTo(() => Rfq)
  declare rfq: BelongsTo<typeof Rfq>

  @belongsTo(() => RfqSupplier)
  declare rfqSupplier: BelongsTo<typeof RfqSupplier>

  @belongsTo(() => Message)
  declare message: BelongsTo<typeof Message>

  @belongsTo(() => MessageAttachment, { foreignKey: 'messageAttachmentId' })
  declare attachment: BelongsTo<typeof MessageAttachment>
}
