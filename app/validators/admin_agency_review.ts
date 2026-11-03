import vine from '@vinejs/vine'
import { AGENCY_REVIEW_DECISIONS, AGENCY_REVIEW_FILTERS } from '#shared/types/agency_review'

/** Filtres de la file de revue des agences (query string), tous optionnels. */
export const agencyReviewFiltersValidator = vine.create({
  status: vine.enum(AGENCY_REVIEW_FILTERS).optional(),
  page: vine.number().positive().optional(),
})

/**
 * Décision sur une inscription agence. Le motif est obligatoire pour un rejet et
 * pour une demande d'informations (c'est le message envoyé à l'agence).
 */
export const agencyReviewDecisionValidator = vine.create({
  decision: vine.enum(AGENCY_REVIEW_DECISIONS),
  reason: vine
    .string()
    .trim()
    .maxLength(1000)
    .optional()
    .requiredWhen('decision', 'in', ['rejected', 'info_requested']),
})
