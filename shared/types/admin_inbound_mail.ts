/**
 * Supervision des mails entrants (#227, `docs/mail.md`) : les réponses des
 * fournisseurs reçues à l'adresse relais, et celles qui n'ont pas pu être
 * rattachées. Écrans `/admin/inbound-mail`, droit `ops.manage`.
 */
import {
  INBOUND_MAIL_STATUSES,
  type InboundAttachmentStatus,
  type InboundMailRejection,
  type InboundMailStatus,
} from '#shared/types/inbound_mail'
import type { RfqSupplierStatus } from '#shared/types/rfq'

/** Mails listés par page. */
export const ADMIN_INBOUND_MAIL_PER_PAGE = 25

/** Couples demande / fournisseur proposés au rattachement manuel. */
export const ADMIN_INBOUND_MAIL_CANDIDATES_LIMIT = 20

/** Filtres de la liste (query string), tous optionnels. */
export type AdminInboundMailFilters = {
  status: InboundMailStatus | null
  rejection: InboundMailRejection | null
}

export type AdminInboundMailListQuery = AdminInboundMailFilters & {
  page: number
  perPage: number
}

/** Nombre de mails par état, tous mails confondus. */
export type AdminInboundMailOverview = Record<InboundMailStatus, number>

/** Couple demande / fournisseur auquel un mail est (ou peut être) rattaché. */
export type AdminInboundMailRecipient = {
  rfqSupplierId: number
  rfqId: number
  rfqTitle: string
  supplierName: string
  status: RfqSupplierStatus
  sentAt: string | null
}

const { received, failed, rejected, processed } = INBOUND_MAIL_STATUSES

/**
 * États depuis lesquels chaque action est possible. Un mail `processing` est
 * entre les mains d'un worker : on attend qu'il en sorte.
 *
 * - rattacher : tout mail pas encore rattaché par son traitement ;
 * - rejouer : idem, plus un mail traité (seul l'enregistrement de la réponse
 *   est rejoué, idempotent) ;
 * - écarter : un mail qui attend ou a échoué.
 */
export const INBOUND_MAIL_ATTACHABLE_STATUSES: InboundMailStatus[] = [received, failed, rejected]
export const INBOUND_MAIL_REPLAYABLE_STATUSES: InboundMailStatus[] = [
  received,
  failed,
  rejected,
  processed,
]
export const INBOUND_MAIL_DISMISSABLE_STATUSES: InboundMailStatus[] = [received, failed]

/** Ce que l'admin peut faire du mail, dans son état actuel. */
export type AdminInboundMailActions = {
  attachable: boolean
  replayable: boolean
  dismissable: boolean
}

/** DTO déclarés en `type` pour rester assignables aux props Inertia. */
export type AdminInboundMailRow = AdminInboundMailActions & {
  id: number
  senderAddress: string
  senderName: string | null
  recipient: string | null
  subject: string | null
  status: InboundMailStatus
  rejectionReason: InboundMailRejection | null
  /** Première ligne de l'erreur, tronquée. */
  error: string | null
  attachedManually: boolean
  target: AdminInboundMailRecipient | null
  receivedAt: string
  processedAt: string | null
}

export type AdminInboundMailAttachment = {
  id: number
  filename: string
  mimeType: string | null
  sizeBytes: number | null
  status: InboundAttachmentStatus
}

export type AdminInboundMailDetail = AdminInboundMailRow & {
  provider: string
  messageId: string | null
  senderKnown: boolean | null
  sizeBytes: number | null
  /** Corps texte seulement : le HTML d'un tiers n'est jamais rendu (cf. `InboundMail`). */
  textBody: string | null
  fullError: string | null
  attachedManuallyAt: string | null
  attachments: AdminInboundMailAttachment[]
}

/**
 * Issue d'un rattachement ou d'un rejeu : l'état du mail après traitement,
 * `republished` (mail déjà traité : seul l'enregistrement de la réponse est
 * rejoué, sans doublon), ou `refused` (action impossible dans cet état).
 */
export type AdminInboundMailOutcome = InboundMailStatus | 'republished' | 'refused'

/** Longueur de l'erreur affichée dans la liste, et sur la fiche. */
export const INBOUND_MAIL_ERROR_SUMMARY_LENGTH = 160
export const INBOUND_MAIL_ERROR_MAX_LENGTH = 4000
