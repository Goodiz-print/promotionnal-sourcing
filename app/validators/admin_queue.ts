import vine from '@vinejs/vine'
import { QUEUE_JOB_FILTER_STATUSES } from '#shared/types/admin_queue'

/** Filtres de la liste des jobs de queue (query string), tous optionnels. */
export const adminQueueFiltersValidator = vine.create({
  status: vine.enum(QUEUE_JOB_FILTER_STATUSES).optional(),
  name: vine.string().trim().maxLength(100).optional(),
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})
