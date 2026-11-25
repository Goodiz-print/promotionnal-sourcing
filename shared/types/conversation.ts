import type { RelayWindow } from './inbound_mail.js'
import type { RfqMailAddress, RfqSupplierStatus } from './rfq.js'

/**
 * Fil de discussion entre une organisation acheteuse et une organisation
 * fournisseur. Un fil peut être rattaché à une RFQ (`rfq_id`), sans y être lié.
 */

/** Longueur maximale d'un message, en caractères. */
export const MESSAGE_MAX_LENGTH = 5000

/**
 * Messages d'un fil de demande montrés à l'écran (#226) : les plus récents. Les
 * plus anciens restent en base ; l'écran signale qu'ils ne sont pas affichés.
 */
export const THREAD_MESSAGES_LIMIT = 100

/**
 * Côté d'un fil qui a écrit un message (#226) : `agency`, l'organisation
 * acheteuse du fil, ou `supplier`. Dit dans quel sens relayer le message.
 */
export const CONVERSATION_SIDES = ['agency', 'supplier'] as const
export type ConversationSide = (typeof CONVERSATION_SIDES)[number]

/** Message écrit dans l'application, avec le côté au nom duquel l'auteur écrit. */
export interface PostedMessageInput {
  body: string
  side: ConversationSide
}

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
  /** Côté qui a écrit le mail, d'après l'adresse relais visée (#226). */
  senderSide: ConversationSide
}

/**
 * Message d'un participant qui joint des fichiers depuis l'application : le
 * devis PDF déposé par un fournisseur depuis une demande reçue (#230). `body`
 * peut être vide, le fichier faisant le message.
 */
export interface UploadedMessageInput {
  authorUserId: number
  body: string
  attachments: MessageAttachmentInput[]
  senderSide: ConversationSide
}

// ─────────────────────────────────────────────────────────────────────────────
// Fil d'échanges d'une demande et relais par mail (#226)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fait annoncé par `ConversationMessageRecorded` : un message à relayer par
 * mail à l'autre côté du fil d'une demande. Émis pour un message écrit dans
 * l'application (les deux côtés) et pour un mail de l'agence ; la réponse du
 * fournisseur reçue par mail passe, elle, par `SupplierReplyRecorded` (#225).
 */
export interface ConversationMessageRecordedData {
  rfqSupplierId: number
  conversationId: number
  messageId: number
  side: ConversationSide
}

/** Message d'un fil tel que l'écran le montre (`type` : une prop Inertia doit être indexable). */
export type ConversationMessageType = {
  id: number
  body: string
  side: ConversationSide
  /** Le message vient du côté de l'organisation qui consulte. */
  mine: boolean
  /** Auteur, montré seulement pour un message de son propre côté. */
  authorName: string | null
  /** Né d'un mail plutôt qu'écrit dans l'application. */
  viaMail: boolean
  /**
   * Expéditeur du mail d'origine et s'il est reconnu (#224). Jamais celui d'un
   * mail de l'agence montré au fournisseur : il trahirait l'agence (#220).
   */
  mailSender: ConversationMailSenderType | null
  createdAt: string
  attachments: ConversationAttachmentType[]
}

export type ConversationMailSenderType = {
  name: string | null
  address: string
  /** Adresse déclarée par ce côté, ou celle d'un de ses membres. */
  known: boolean
}

export type ConversationAttachmentType = {
  id: number
  filename: string
}

/** Fil d'une demande pour un destinataire, vu d'un côté. */
export type RfqThreadType = {
  rfqSupplierId: number
  /**
   * Nom de l'autre côté : le fournisseur pour l'agence, l'agence pour un
   * fournisseur abonné ; `null` pour un fournisseur non abonné (#220).
   */
  counterpartName: string | null
  /** Fil bloqué par la plateforme (#167) : lecture seule. */
  blocked: boolean
  /**
   * Fil clos : l'adresse relais de la demande a expiré (`graceDays` après sa
   * clôture ou son expiration), on n'y écrit plus — ni par mail, ni ici.
   */
  closed: boolean
  canWrite: boolean
  /** Des messages plus anciens que ceux affichés existent (`THREAD_MESSAGES_LIMIT`). */
  hasOlder: boolean
  messages: ConversationMessageType[]
}

/**
 * Ce qui décide si le fil d'un destinataire est ouvert à l'écriture (#226) : la
 * demande (identifiant et fenêtre de son adresse relais) et le destinataire.
 */
export interface RfqThreadState {
  rfq: RelayWindow & { id: number }
  recipient: { rfqId: number; status: RfqSupplierStatus }
}

/** Libellés de l'expéditeur d'un message affiché : l'autre côté, ou son équipe. */
export interface MessageSenderLabels {
  counterpart: string
  yourTeam: string
}

/** Derniers messages d'un fil, du plus ancien au plus récent, et s'il en existe d'autres. */
export interface ThreadMessagesWindow<M> {
  messages: M[]
  hasOlder: boolean
}

/** Fil d'un destinataire chargé pour l'écran : le fil et ses derniers messages visibles. */
export interface LoadedRfqThread<C, M> extends ThreadMessagesWindow<M> {
  conversation: C
}

/**
 * Ce qu'il faut pour montrer le fil d'un destinataire d'un côté : le fil chargé
 * (`null` s'il n'est pas encore ouvert), le côté qui consulte, le nom de
 * l'autre côté, le droit d'écrire et si le fil est clos.
 */
export interface RfqThreadView<C, M> {
  thread: LoadedRfqThread<C, M> | null
  viewerSide: ConversationSide
  counterpartName: string | null
  canWrite: boolean
  closed: boolean
}

/** Textes du mail relayé : l'agence nommée (abonné) ou anonyme. */
export type AgencyMessageVariant = 'named' | 'anonymous'

/**
 * Message de l'agence prêt à être relayé au fournisseur (#226), résolu par
 * `MessageRelayService`. `agencyName` n'est renseigné que pour un abonné.
 */
export interface AgencyMessageNotice {
  rfqId: number
  rfqTitle: string
  agencyName: string | null
  /** Message du fil : clé d'idempotence des envois. */
  messageId: number
  body: string
  attachments: string[]
  /** Adresse relais côté fournisseur, en `Reply-To`. */
  replyTo: string | null
  /** En-têtes du mail d'origine que le relais peut reprendre (`relayableHeaders`). */
  headers: Record<string, string>
}

/** Ce qu'il faut pour construire la charge du mail relayé à une adresse du fournisseur. */
export interface AgencyMessageMailInput {
  notice: AgencyMessageNotice
  address: RfqMailAddress
  /** Chemin de la demande reçue, dans la langue de l'adresse. */
  rfqPath: string
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
