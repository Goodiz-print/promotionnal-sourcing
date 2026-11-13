/**
 * Réponse d'un fournisseur reçue par mail et enregistrée (#224) : un message
 * du fil de la demande, ses pièces jointes et, s'il y a un PDF, un devis.
 */

/** Type MIME d'un devis reçu par mail : seul un PDF est pris pour un devis. */
export const QUOTE_DOCUMENT_MIME_TYPE = 'application/pdf'

/** Fait annoncé par l'événement `SupplierReplyRecorded`. */
export interface SupplierReplyRecordedData {
  inboundMailId: number
  rfqSupplierId: number
  conversationId: number
  messageId: number
  /** Devis PDF apportés par cette réponse ; vide pour un simple message. */
  quoteDocumentIds: number[]
  /** Vrai si cette réponse a fait passer le destinataire à « répondu ». */
  responded: boolean
}

/**
 * Pièce jointe d'un mail prête à être rattachée au message : `storageObjectId`
 * est le fichier à référencer (le PDF compressé, sinon le fichier reçu).
 */
export interface PreparedReplyAttachment {
  inboundAttachmentId: number
  /** Fichier tel que reçu, référencé par le journal des mails. */
  receivedObjectId: number
  storageObjectId: number
  filename: string
  mimeType: string
  sizeBytes: number
}
