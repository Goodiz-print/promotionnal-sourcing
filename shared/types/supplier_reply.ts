/**
 * Réponse d'un fournisseur reçue par mail et enregistrée (#224) : un message
 * du fil de la demande, ses pièces jointes et, s'il y a un PDF, un devis.
 */

import type { Locale } from './i18n.js'

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
  /** Vrai si la réponse est arrivée après l'échéance de la demande (#232). */
  late: boolean
}

/** Ce que la transmission à l'agence lit d'une réponse (#225), ou d'un message écrit dans l'application (#226). */
export type SupplierReplyToNotify = Pick<
  SupplierReplyRecordedData,
  'rfqSupplierId' | 'messageId' | 'quoteDocumentIds' | 'late'
>

/**
 * Pièce jointe d'un mail prête à être rattachée au message : `storageObjectId`
 * est le fichier à référencer (le PDF compressé, sinon le fichier reçu).
 */
export interface PreparedReplyAttachment {
  inboundAttachmentId: number
  /** Fichier tel que reçu, référencé par le journal des mails. */
  receivedObjectId: number
  storageObjectId: number
  /**
   * Copie du PDF portant le nom de l'agence (#238), pour un fournisseur non
   * abonné ; `null` sinon. L'agence la reçoit, le fournisseur garde l'original.
   */
  recipientObjectId: number | null
  filename: string
  mimeType: string
  sizeBytes: number
}

/**
 * Réponse d'un fournisseur prête à être transmise à l'agence (#225), résolue
 * depuis `SupplierReplyRecordedData` par `SupplierReplyNotificationService`.
 * Données seulement : le nom du fournisseur y figure, l'agence le connaît.
 */
export interface SupplierReplyNotice {
  rfqId: number
  rfqTitle: string
  supplierName: string
  /** Message du fil qui porte la réponse : clé d'idempotence des envois. */
  messageId: number
  body: string
  /** Devis PDF de la réponse ; le fichier servi est `QuoteDocument#recipientFile`. */
  documents: SupplierReplyNoticeDocument[]
  /** Adresse relais côté agence, en `Reply-To` : la réponse est relayée au fournisseur (#226). */
  replyTo: string | null
  /** Réponse arrivée après l'échéance : le mail et la notification le signalent (#232). */
  late: boolean
}

export interface SupplierReplyNoticeDocument {
  id: number
  filename: string
}

/** Destinataire de la transmission : l'auteur de la demande ou un responsable de l'agence. */
export interface SupplierReplyRecipient {
  userId: number
  email: string
  locale: Locale
}

/** Ce que la transmission a produit : mails mis en queue, notifications créées. */
export interface SupplierReplyNotificationOutcome {
  mails: number
  notifications: number
}

/** Chemins relatifs du mail transmis, déjà dans la langue du destinataire. */
export interface SupplierReplyMailPaths {
  rfqPath: string
  /** Lien de téléchargement de chaque devis, par identifiant de `quote_documents`. */
  documentPaths: Record<number, string>
}

/** Ce qu'il faut pour construire la charge du mail transmis à un destinataire. */
export interface SupplierReplyMailInput {
  notice: SupplierReplyNotice
  user: SupplierReplyRecipient
  paths: SupplierReplyMailPaths
}
