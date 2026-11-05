import vine from '@vinejs/vine'
import { LEGAL_CONSENT_KINDS } from '#shared/types/legal'

/** Filtres de la liste des consentements (query string), tous optionnels. */
export const adminConsentFiltersValidator = vine.create({
  organization: vine.string().trim().maxLength(100).optional(),
  user: vine.string().trim().maxLength(254).optional(),
  kind: vine.enum(LEGAL_CONSENT_KINDS).optional(),
  version: vine.string().trim().maxLength(50).optional(),
  outdated: vine.boolean().optional(),
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})

/** Export de preuve : l'organisation est obligatoire. */
export const adminConsentExportValidator = vine.create({
  organizationId: vine.number().withoutDecimals().min(1),
})
