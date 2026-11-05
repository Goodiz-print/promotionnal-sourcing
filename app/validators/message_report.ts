import vine from '@vinejs/vine'
import { MESSAGE_REPORT_NOTE_MAX_LENGTH, MESSAGE_REPORT_REASONS } from '#shared/types/conversation'

/** Signalement d'un message par un participant : un motif, des précisions facultatives. */
export const reportMessageValidator = vine.create({
  reason: vine.enum(MESSAGE_REPORT_REASONS),
  details: vine.string().trim().maxLength(MESSAGE_REPORT_NOTE_MAX_LENGTH).optional(),
})
