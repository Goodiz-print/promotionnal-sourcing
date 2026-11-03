import vine from '@vinejs/vine'
import { SEARCH_EVENT_SOURCES } from '#shared/types/search_event'
import { ORGANIZATION_TYPES } from '#shared/types/organization'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Filtres de l'écran de la demande client (query string), tous optionnels. */
export const adminDemandFiltersValidator = vine.create({
  from: vine.string().regex(ISO_DATE).optional(),
  to: vine.string().regex(ISO_DATE).optional(),
  source: vine.enum(SEARCH_EVENT_SOURCES).optional(),
  locale: vine.string().trim().minLength(2).maxLength(5).optional(),
  organizationType: vine.enum(ORGANIZATION_TYPES).optional(),
})
