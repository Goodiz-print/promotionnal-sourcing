import vine from '@vinejs/vine'
import { MODERATION_AGE_FILTERS } from '#shared/types/admin_moderation'
import { MODERATION_DECISIONS, MODERATION_TARGET_TYPES } from '#shared/types/moderation'

/**
 * Filtres de la file de modération (query string). Tout est optionnel ; une
 * valeur invalide est une erreur de validation, pas un filtre ignoré en silence.
 */
export const moderationFiltersValidator = vine.create({
  type: vine.enum(MODERATION_TARGET_TYPES).optional(),
  status: vine.enum(['pending', ...MODERATION_DECISIONS] as const).optional(),
  minAgeDays: vine.enum(MODERATION_AGE_FILTERS).optional(),
  page: vine.number().positive().optional(),
})

/**
 * Décision sur un élément. Le motif est obligatoire pour un rejet : il est
 * conservé dans l'historique et dans le journal d'audit.
 */
export const moderationDecisionValidator = vine.create({
  status: vine.enum(MODERATION_DECISIONS),
  reason: vine.string().trim().maxLength(1000).optional().requiredWhen('status', '=', 'rejected'),
})
