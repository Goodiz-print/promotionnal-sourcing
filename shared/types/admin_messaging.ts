import type { AdminActionContext } from '#shared/types/admin_audit'
import type {
  MessageReportReason,
  MessageReportResolution,
  MessageReportStatus,
} from '#shared/types/conversation'

/**
 * Modération de la messagerie par la plateforme (#167). Types exposés en props
 * Inertia : des `type`, pas des `interface`.
 */

export type AdminMessagingParty = { id: number; name: string }

/** Filtres de la liste des fils : noms partiels (sans casse), signalements ouverts, fils bloqués. */
export type AdminConversationFilters = {
  buyer: string | null
  supplier: string | null
  withOpenReports: boolean
  blocked: boolean
}

export type AdminReportFilters = { status: MessageReportStatus }

export type AdminMessagingListOptions<F> = F & { page: number; perPage: number }

export type AdminConversationRow = {
  id: number
  subject: string | null
  rfqId: number | null
  buyer: AdminMessagingParty
  supplier: AdminMessagingParty
  messagesCount: number
  openReportsCount: number
  blockedAt: string | null
  lastMessageAt: string | null
  createdAt: string
}

/** Signalement dans la file : assez de contexte pour décider sans ouvrir le fil. */
export type AdminReportRow = {
  id: number
  status: MessageReportStatus
  resolution: MessageReportResolution | null
  reason: MessageReportReason
  details: string | null
  reporterEmail: string | null
  createdAt: string
  messageId: number
  messageExcerpt: string
  conversationId: number
  conversationSubject: string | null
  buyerName: string
  supplierName: string
}

export type AdminMessageReport = {
  id: number
  status: MessageReportStatus
  resolution: MessageReportResolution | null
  reason: MessageReportReason
  details: string | null
  reporterEmail: string | null
  createdAt: string
}

export type AdminMessageRow = {
  id: number
  body: string
  authorEmail: string | null
  authorOrganizationId: number | null
  createdAt: string
  hiddenAt: string | null
  reports: AdminMessageReport[]
}

export type AdminConversationDetail = {
  conversation: AdminConversationRow
  blockedReason: string | null
  messages: AdminMessageRow[]
}

/** Contexte d'audit commun aux actions de modération. */
export type AdminMessagingActionOptions = {
  context: AdminActionContext
}

export type AdminMessageActionOptions = AdminMessagingActionOptions & {
  messageId: number
  /** Signalement à clore avec l'action, quand elle en découle. */
  reportId?: number | null
  note?: string | null
}

export type AdminReportActionOptions = AdminMessagingActionOptions & {
  reportId: number
  note?: string | null
}

export type AdminConversationBlockOptions = AdminMessagingActionOptions & {
  conversationId: number
  reason: string
}
