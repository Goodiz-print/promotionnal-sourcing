import { BaseTransformer } from '@adonisjs/core/transformers'
import type QuoteDocument from '#models/quote_document'
import type { SupplierQuoteDocumentType } from '#shared/types/quote'

/**
 * Devis PDF envoyé, vu du fournisseur qui l'a envoyé (#230) : nom et taille du
 * fichier, date, mode d'envoi. Ni clé de stockage, ni version au nom de
 * l'agence (#238), ni identifiant de message : le fichier d'origine se
 * télécharge par la route réservée au destinataire. Suppose préchargés
 * `attachment` et `message` (`QuoteService#documentsSentBy`).
 */
export default class SupplierQuoteDocumentTransformer extends BaseTransformer<QuoteDocument> {
  toObject(): SupplierQuoteDocumentType {
    return {
      id: this.resource.id,
      filename: this.resource.attachment.filename,
      sizeBytes: this.resource.attachment.sizeBytes,
      receivedAt: this.resource.receivedAt.toISO()!,
      viaMail: this.resource.message.inboundMailId !== null,
    }
  }
}
