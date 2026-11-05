import vine from '@vinejs/vine'
import { IMPORT_KINDS, IMPORT_STATUSES } from '#shared/types/import_job'

/** Filtres de la liste des imports (query string), tous optionnels. */
export const adminImportFiltersValidator = vine.create({
  status: vine.enum(IMPORT_STATUSES).optional(),
  kind: vine.enum(IMPORT_KINDS).optional(),
  organization: vine.string().trim().maxLength(100).optional(),
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})
