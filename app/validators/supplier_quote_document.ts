import vine from '@vinejs/vine'
import { MESSAGE_MAX_LENGTH } from '#shared/types/conversation'
import { DOCUMENT_MAX_SIZE } from '#shared/types/document'

/**
 * Devis PDF déposé par le fournisseur depuis une demande reçue (#230), en
 * alternative à la réponse par mail : même limite que les autres PDF qu'il
 * dépose (`DOCUMENT_MAX_SIZE`). Le contenu est vérifié comme PDF par
 * `SupplierReplyService` (en-tête `%PDF-`). `body` : mot d'accompagnement,
 * facultatif, qui entre dans le fil avec le fichier.
 */
export const supplierQuoteDocumentValidator = vine.create({
  file: vine.file({ size: DOCUMENT_MAX_SIZE, extnames: ['pdf'] }),
  body: vine.string().trim().maxLength(MESSAGE_MAX_LENGTH).optional(),
})
