import { BaseTransformer } from '@adonisjs/core/transformers'
import type QuoteDocument from '#models/quote_document'
import type { QuoteDocumentType } from '#shared/types/quote'

/**
 * Devis PDF reçu, pour l'écran de la demande (#228) : fournisseur, nom et
 * taille du fichier, dates de réception et de sélection. Ni clé de stockage,
 * ni message, ni pièce jointe : le fichier se télécharge par la route réservée
 * à l'agence. Suppose préchargés `attachment` et
 * `rfqSupplier.supplierOrganization` (`QuoteService#documentsForRfq`, qui reprend
 * les destinataires déjà chargés de la demande).
 */
export default class QuoteDocumentTransformer extends BaseTransformer<QuoteDocument> {
  toObject(): QuoteDocumentType {
    return {
      id: this.resource.id,
      rfqSupplierId: this.resource.rfqSupplierId,
      supplierName: this.resource.rfqSupplier.supplierOrganization.name,
      filename: this.resource.attachment.filename,
      sizeBytes: this.resource.attachment.sizeBytes,
      receivedAt: this.resource.receivedAt.toISO()!,
      selectedAt: this.resource.selectedAt?.toISO() ?? null,
    }
  }
}
