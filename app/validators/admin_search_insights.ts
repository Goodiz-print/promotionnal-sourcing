import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { SEARCH_EVENT_SOURCES } from '#shared/types/search_event'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'
import { ORGANIZATION_TYPES } from '#shared/types/organization'
import { invalidSearchInsightsPeriod } from '#exceptions/admin_errors'
import type { SearchInsightsFilters } from '#shared/types/search_insights'
import {
  SEARCH_INSIGHTS_DEFAULT_DAYS,
  SEARCH_INSIGHTS_MAX_DAYS,
} from '#shared/types/search_insights'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Filtres de l'écran « Ce que cherchent les clients » (query string).
 * `from` et `to` sont optionnels ; quand absents, la période par défaut est
 * les 30 derniers jours. Une période > 366 jours ou `from > to` est refusée.
 */
export const searchInsightsFiltersValidator = vine.compile(
  vine.object({
    from: vine
      .string()
      .regex(ISO_DATE)
      .optional()
      .transform((value) => value ?? null),
    to: vine
      .string()
      .regex(ISO_DATE)
      .optional()
      .transform((value) => value ?? null),
    source: vine
      .enum(SEARCH_EVENT_SOURCES)
      .optional()
      .transform((value) => value ?? null),
    locale: vine
      .enum(SUPPORTED_LOCALES)
      .optional()
      .transform((value) => value ?? null),
    organizationType: vine
      .enum(ORGANIZATION_TYPES)
      .optional()
      .transform((value) => value ?? null),
  })
)

/** Filtres validés par `searchInsightsFiltersValidator`. */
type ParsedFilters = Awaited<ReturnType<typeof searchInsightsFiltersValidator.validate>>

/**
 * Applique la période par défaut (30 derniers jours) puis vérifie `from <= to`
 * et la durée maximale ; sinon lève une erreur de validation (422).
 */
export function normalizeSearchInsightsFilters(parsed: ParsedFilters): SearchInsightsFilters {
  const today = DateTime.now().setZone('Europe/Paris').startOf('day')
  const from = parsed.from
    ? DateTime.fromISO(parsed.from, { zone: 'Europe/Paris' })
    : today.minus({ days: SEARCH_INSIGHTS_DEFAULT_DAYS - 1 })
  const to = parsed.to ? DateTime.fromISO(parsed.to, { zone: 'Europe/Paris' }) : today

  if (!from.isValid) throw invalidSearchInsightsPeriod('from', 'invalidDate')
  if (!to.isValid) throw invalidSearchInsightsPeriod('to', 'invalidDate')
  if (from > to) throw invalidSearchInsightsPeriod('from', 'order')
  if (Math.round(to.diff(from, 'days').days) + 1 > SEARCH_INSIGHTS_MAX_DAYS) {
    throw invalidSearchInsightsPeriod('to', 'maxDays')
  }

  return {
    from: from.toFormat('yyyy-MM-dd'),
    to: to.toFormat('yyyy-MM-dd'),
    source: parsed.source ?? null,
    locale: parsed.locale ?? null,
    organizationType: parsed.organizationType ?? null,
  }
}
