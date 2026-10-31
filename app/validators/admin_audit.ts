import vine from '@vinejs/vine'
import { ADMIN_AUDIT_ACTIONS, ADMIN_AUDIT_TARGET_TYPES } from '#shared/types/admin_audit'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Filtres du journal d'audit (query string). Tout est optionnel ; une valeur
 * invalide est une erreur de validation, pas un filtre ignoré en silence.
 */
export const auditFiltersValidator = vine.create({
  action: vine.enum(ADMIN_AUDIT_ACTIONS).optional(),
  targetType: vine.enum(ADMIN_AUDIT_TARGET_TYPES).optional(),
  actor: vine.string().trim().maxLength(254).optional(),
  from: vine.string().regex(ISO_DATE).optional(),
  to: vine.string().regex(ISO_DATE).optional(),
  page: vine.number().positive().optional(),
})
