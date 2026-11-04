import vine from '@vinejs/vine'
import { PLATFORM_ROLES } from '#shared/types/user'
import { ORGANIZATION_TYPES } from '#shared/types/organization'

/**
 * Changement du rôle plateforme d'un compte (écran Utilisateurs du back-office).
 */
export const updatePlatformRoleValidator = vine.create({
  platformRole: vine.enum(PLATFORM_ROLES),
})

/** Valeurs admises pour le filtre de rôle plateforme. */
const PLATFORM_ROLE_FILTER_VALUES = [...PLATFORM_ROLES, 'any-role'] as const

/** Valeurs admises pour le filtre de vérification email. */
const EMAIL_VERIFIED_VALUES = ['verified', 'unverified'] as const

/** Valeurs admises pour le filtre d'activité. */
const ACTIVITY_VALUES = ['recent', 'never'] as const

/** Valeurs admises pour le filtre de statut de suspension. */
const STATUS_VALUES = ['active', 'suspended'] as const

/**
 * Filtres de la liste des utilisateurs (query string), tous optionnels.
 * Une valeur invalide est refusée en 422, comme les autres écrans admin.
 */
export const adminUserFiltersValidator = vine.create({
  search: vine.string().trim().maxLength(255).optional(),
  platformRole: vine.enum(PLATFORM_ROLE_FILTER_VALUES).optional(),
  emailVerified: vine.enum(EMAIL_VERIFIED_VALUES).optional(),
  activity: vine.enum(ACTIVITY_VALUES).optional(),
  organizationType: vine.enum(ORGANIZATION_TYPES).optional(),
  status: vine.enum(STATUS_VALUES).optional(),
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})

/**
 * Action de suspension : motif optionnel (max 500 caractères).
 */
export const suspendUserValidator = vine.create({
  reason: vine.string().trim().maxLength(500).optional(),
})
