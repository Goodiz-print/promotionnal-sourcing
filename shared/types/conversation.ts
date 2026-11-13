/**
 * Fil de discussion entre une organisation acheteuse et une organisation
 * fournisseur. Un fil peut être rattaché à une RFQ (`rfq_id`), sans y être lié.
 */

/** Longueur maximale d'un message, en caractères. */
export const MESSAGE_MAX_LENGTH = 5000

// ─────────────────────────────────────────────────────────────────────────────
// Messages nés d'un mail entrant (#224)
// ─────────────────────────────────────────────────────────────────────────────

/** Pièce jointe à rattacher à un message : son fichier est déjà sur Cellar. */
export interface MessageAttachmentInput {
  storageObjectId: number
  filename: string
  mimeType: string
  sizeBytes: number
}

/**
 * Message né d'un mail entrant. `inboundMailId` est sa clé d'idempotence : un
 * mail ne donne qu'un message.
 */
export interface InboundMessageInput {
  inboundMailId: number
  body: string
  attachments: MessageAttachmentInput[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Modération de la messagerie (#167)
// ─────────────────────────────────────────────────────────────────────────────

/** Motifs proposés à l'utilisateur qui signale un message. */
export const MESSAGE_REPORT_REASONS = ['spam', 'abuse', 'off_platform', 'fraud', 'other'] as const
export type MessageReportReason = (typeof MESSAGE_REPORT_REASONS)[number]

/** Longueur maximale des précisions saisies par le signalant ou le modérateur. */
export const MESSAGE_REPORT_NOTE_MAX_LENGTH = 1000

export const MESSAGE_REPORT_STATUSES = ['open', 'resolved'] as const
export type MessageReportStatus = (typeof MESSAGE_REPORT_STATUSES)[number]

/** Issue d'un signalement traité : classé sans suite, message masqué ou auteur averti. */
export const MESSAGE_REPORT_RESOLUTIONS = ['dismissed', 'hidden', 'warned'] as const
export type MessageReportResolution = (typeof MESSAGE_REPORT_RESOLUTIONS)[number]
