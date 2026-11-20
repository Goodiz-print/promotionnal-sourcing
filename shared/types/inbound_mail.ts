/**
 * Réception des mails entrants (#223, `docs/mail.md`, ADR 0005) : la réponse
 * d'un fournisseur à une demande de devis, envoyée à l'adresse relais du couple
 * demande / fournisseur.
 */

/** Prestataires de réception connus. `none` : réception désactivée. */
export const INBOUND_MAIL_PROVIDERS = ['resend', 'none'] as const
export type InboundMailProviderName = (typeof INBOUND_MAIL_PROVIDERS)[number]

/**
 * Cycle de vie d'une ligne `inbound_mails` :
 * - `received` : journalisée par le webhook, en attente du worker ;
 * - `processing` : prise par un job (verrou contre deux traitements concurrents) ;
 * - `processed` : rattachée à son couple demande / fournisseur, contenu copié ;
 * - `rejected` : écartée par un garde-fou (`rejectionReason`) ;
 * - `failed` : le traitement a levé une erreur, le job sera rejoué.
 */
export const INBOUND_MAIL_STATUSES = {
  received: 'received',
  processing: 'processing',
  processed: 'processed',
  rejected: 'rejected',
  failed: 'failed',
} as const
export type InboundMailStatus = (typeof INBOUND_MAIL_STATUSES)[keyof typeof INBOUND_MAIL_STATUSES]

/** Motif d'un mail écarté. */
export const INBOUND_MAIL_REJECTIONS = {
  tooLarge: 'too_large',
  loop: 'loop',
  autoReply: 'auto_reply',
  unknownAddress: 'unknown_address',
  expiredAddress: 'expired_address',
  /** Écarté à la main par un admin depuis la supervision (#227). */
  dismissed: 'dismissed',
} as const
export type InboundMailRejection =
  (typeof INBOUND_MAIL_REJECTIONS)[keyof typeof INBOUND_MAIL_REJECTIONS]

/** Sort d'une pièce jointe. Seule `stored` porte un fichier sur Cellar. */
export const INBOUND_ATTACHMENT_STATUSES = {
  stored: 'stored',
  rejectedType: 'rejected_type',
  rejectedSize: 'rejected_size',
  /** Image intégrée au corps du mail (logo de signature) : jamais stockée. */
  ignoredInline: 'ignored_inline',
} as const
export type InboundAttachmentStatus =
  (typeof INBOUND_ATTACHMENT_STATUSES)[keyof typeof INBOUND_ATTACHMENT_STATUSES]

/**
 * Types de pièces jointes acceptés : extension → type MIME stocké. L'extension
 * du nom de fichier fait foi (le type annoncé par la messagerie de l'expéditeur
 * n'est pas fiable) ; tout le reste est journalisé `rejected_type`.
 */
export const INBOUND_ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odt: 'application/vnd.oasis.opendocument.text',
  csv: 'text/csv',
}

/** En-têtes HTTP d'une requête de webhook, tels que les expose le framework. */
export type InboundWebhookHeaders = Record<string, string | string[] | undefined>

/** Ce qu'annonce le webhook du prestataire : des métadonnées, jamais le contenu. */
export interface InboundMailNotification {
  /** Identifiant du mail chez le prestataire : clé d'idempotence. */
  providerMessageId: string
  /** Toutes les adresses visées (destinataires, copies, adresse de remise). */
  recipients: string[]
  /** Expéditeur brut, `Nom <adresse>` ou adresse seule. */
  from: string
  subject: string | null
  /** En-tête `Message-ID` du mail. */
  messageId: string | null
  receivedAt: string
}

/** Pièce jointe décrite par le prestataire. */
export interface InboundAttachmentDescriptor {
  id: string
  filename: string
  contentType: string | null
  sizeBytes: number | null
  /** Intégrée au corps (`Content-Disposition: inline` avec un `Content-ID`). */
  inline: boolean
}

/** Contenu d'un mail reçu, lu par le worker auprès du prestataire. */
export interface InboundMailContent {
  text: string | null
  html: string | null
  /** En-têtes du mail, noms en minuscules. */
  headers: Record<string, string>
  /** Taille du mail d'origine, pièces jointes comprises, si elle est connue. */
  sizeBytes: number | null
  attachments: InboundAttachmentDescriptor[]
}

/** Résultat de la réception d'un webhook. */
export type InboundMailReceipt = 'queued' | 'duplicate' | 'ignored'

/** Charge de `ProcessInboundMailJob`. */
export interface ProcessInboundMailPayload {
  inboundMailId: number
}

/** Fait annoncé par l'événement `InboundMailProcessingFailed` (tentatives épuisées). */
export interface InboundMailProcessingFailure {
  inboundMailId: number
  error: string
}

/** Contenu de l'alerte « mail entrant en échec définitif » (#227). */
export interface InboundMailFailureAlertData {
  inboundMailId: number
  senderAddress: string
  recipient: string | null
  subject: string | null
  error: string
  receivedAt: string
  /** Mails entrants en échec reçus sur les dernières 24 h, celui-ci compris. */
  recentFailures: number
  /** Fiche du mail dans la supervision. */
  adminUrl: string
}

/** Fait annoncé par l'événement `InboundMailReceived`. */
export interface InboundMailReceivedData {
  inboundMailId: number
  rfqSupplierId: number
}

/** Mail saisi à la main par `node ace inbound-mail:simulate` (développement). */
export interface SimulatedInboundMail {
  to: string
  from: string
  subject: string
  text: string
  headers: Record<string, string>
  attachments: Array<{ filename: string; content: Buffer }>
}

/** Expéditeur décomposé. */
export interface MailAddressParts {
  address: string
  name: string | null
}
