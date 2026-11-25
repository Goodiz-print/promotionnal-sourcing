import vine from '@vinejs/vine'
import {
  SUPPLIER_INSIGHTS_MAX_PAGE,
  SUPPLIER_INSIGHTS_PERIODS,
} from '#shared/types/supplier_insights'

/**
 * Filtres de l'écran « Consultations » (query string), tous optionnels : période
 * proposée (en jours) et page du tableau des produits.
 */
export const supplierInsightsQueryValidator = vine.create({
  period: vine
    .number()
    .in([...SUPPLIER_INSIGHTS_PERIODS])
    .optional(),
  page: vine.number().withoutDecimals().min(1).max(SUPPLIER_INSIGHTS_MAX_PAGE).optional(),
})
