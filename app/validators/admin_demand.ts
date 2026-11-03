import vine from '@vinejs/vine'
import { SEARCH_EVENT_SOURCES } from '#shared/types/search_event'
import { ORGANIZATION_TYPES } from '#shared/types/organization'

const DATE_OPTIONS = { formats: ['YYYY-MM-DD'] }

/**
 * Filtres de l'écran de la demande client (query string), tous optionnels. Les
 * dates sont de vraies dates du calendrier (`2026-13-45` est refusé) et `to`
 * ne peut pas précéder `from`.
 */
export const adminDemandFiltersValidator = vine.create({
  from: vine.date(DATE_OPTIONS).optional(),
  to: vine.date(DATE_OPTIONS).afterOrEqual('from').optional(),
  source: vine.enum(SEARCH_EVENT_SOURCES).optional(),
  locale: vine.string().trim().minLength(2).maxLength(5).optional(),
  organizationType: vine.enum(ORGANIZATION_TYPES).optional(),
})
