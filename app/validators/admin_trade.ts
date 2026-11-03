import vine from '@vinejs/vine'
import type { DateTime } from 'luxon'
import { RFQ_ATTENTION_FLAGS } from '#shared/types/admin_trade'
import { ORDER_STATUSES } from '#shared/types/order'
import { QUOTE_STATUSES } from '#shared/types/quote'
import { RFQ_STATUSES } from '#shared/types/rfq'
import type { AdminTradePeriodFilters } from '#shared/types/admin_trade'

const DATE_OPTIONS = { formats: ['YYYY-MM-DD'] }

const parties = {
  buyer: vine.string().trim().maxLength(100).optional(),
  supplier: vine.string().trim().maxLength(100).optional(),
  from: vine.date(DATE_OPTIONS).optional(),
  to: vine.date(DATE_OPTIONS).optional(),
  page: vine.number().positive().optional(),
}

/** Filtres de la liste des demandes de devis (query string), tous optionnels. */
export const adminRfqFiltersValidator = vine.create({
  ...parties,
  status: vine.enum(RFQ_STATUSES).optional(),
  attention: vine.enum(RFQ_ATTENTION_FLAGS).optional(),
})

export const adminQuoteFiltersValidator = vine.create({
  ...parties,
  status: vine.enum(QUOTE_STATUSES).optional(),
})

export const adminOrderFiltersValidator = vine.create({
  ...parties,
  status: vine.enum(ORDER_STATUSES).optional(),
})

/** Filtres communs normalisés : dates au format `AAAA-MM-JJ`, `null` quand absents. */
export function periodFilters(query: {
  buyer?: string
  supplier?: string
  from?: DateTime
  to?: DateTime
}): AdminTradePeriodFilters {
  const day = (date?: DateTime) => date?.toFormat('yyyy-MM-dd') ?? null
  return {
    buyer: query.buyer || null,
    supplier: query.supplier || null,
    from: day(query.from),
    to: day(query.to),
  }
}
