import vine from '@vinejs/vine'
import { MESSAGE_REPORT_NOTE_MAX_LENGTH, MESSAGE_REPORT_STATUSES } from '#shared/types/conversation'

const page = vine.number().withoutDecimals().min(1).max(100000).optional()

/** Booléen de query string (`?blocked=1`) : absent ou `0`/`false` = filtre inactif. */
const flag = () => vine.boolean().optional()

/** Filtres de la liste des fils (query string), tous optionnels. */
export const adminConversationFiltersValidator = vine.create({
  buyer: vine.string().trim().maxLength(100).optional(),
  supplier: vine.string().trim().maxLength(100).optional(),
  withOpenReports: flag(),
  blocked: flag(),
  page,
})

/** Filtre de la file de signalements : ouverts par défaut. */
export const adminReportFiltersValidator = vine.create({
  status: vine.enum(MESSAGE_REPORT_STATUSES).optional(),
  page,
})

/** Note libre du modérateur, conservée sur le signalement clos. */
export const adminModerationNoteValidator = vine.create({
  note: vine.string().trim().maxLength(MESSAGE_REPORT_NOTE_MAX_LENGTH).optional(),
  /** Signalement dont la décision découle (informatif : tous ceux du message sont clos). */
  reportId: vine.number().withoutDecimals().positive().optional(),
})

/** Blocage d'un fil : le motif est obligatoire, il est tracé dans l'audit. */
export const adminBlockConversationValidator = vine.create({
  reason: vine.string().trim().minLength(3).maxLength(MESSAGE_REPORT_NOTE_MAX_LENGTH),
})
