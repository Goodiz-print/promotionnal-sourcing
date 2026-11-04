import vine from '@vinejs/vine'
import { ORGANIZATION_TYPES } from '#shared/types/organization'
import { ADMIN_ORGANIZATION_STATUS_FILTERS } from '#shared/types/admin_organization'

/** Valeurs admises pour le filtre de statut. */
const STATUS_VALUES = ADMIN_ORGANIZATION_STATUS_FILTERS

/** Pattern pour code pays ISO 2 lettres (majuscules). */
const ISO_COUNTRY_REGEX = /^[A-Z]{2}$/

/**
 * Filtres de la liste des organisations (query string), tous optionnels.
 * Une valeur invalide est refusee en 422, comme les autres ecrans admin.
 */
export const adminOrganizationFiltersValidator = vine.create({
  search: vine.string().trim().maxLength(255).optional(),
  type: vine.enum(ORGANIZATION_TYPES).optional(),
  status: vine.enum(STATUS_VALUES).optional(),
  country: vine
    .string()
    .regex(ISO_COUNTRY_REGEX)
    .transform((v) => v.toUpperCase())
    .optional(),
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})

/**
 * Modification d'une organisation par l'admin (memes regles que
 * updateOrganizationValidator, avec country ISO2, slug et logo exclus).
 */
export const adminOrganizationUpdateValidator = vine.create({
  name: vine.string().minLength(2).maxLength(255).trim().optional(),
  siret: vine
    .string()
    .regex(/^\d{14}$/)
    .optional()
    .nullable(),
  vatNumber: vine.string().maxLength(30).optional().nullable(),
  email: vine.string().email().maxLength(254).optional().nullable(),
  phone: vine.string().maxLength(30).optional().nullable(),
  website: vine.string().url().maxLength(500).optional().nullable(),
  industry: vine.string().maxLength(100).optional().nullable(),
  size: vine
    .enum(['micro', 'small', 'medium', 'large', 'enterprise'] as const)
    .optional()
    .nullable(),
  description: vine.string().maxLength(2000).optional().nullable(),
  addressLine1: vine.string().maxLength(255).optional().nullable(),
  addressLine2: vine.string().maxLength(255).optional().nullable(),
  city: vine.string().maxLength(100).optional().nullable(),
  postalCode: vine
    .string()
    .regex(/^\d{5}$/)
    .optional()
    .nullable(),
  country: vine
    .string()
    .regex(ISO_COUNTRY_REGEX)
    .transform((v) => v.toUpperCase())
    .optional(),
})

/**
 * Changement de type d'une organisation.
 */
export const adminOrganizationTypeValidator = vine.create({
  organizationType: vine.enum(ORGANIZATION_TYPES),
})

/**
 * Changement de role d'un membre.
 */
export const adminOrganizationMemberRoleValidator = vine.create({
  roleId: vine.number().withoutDecimals().min(1),
})
