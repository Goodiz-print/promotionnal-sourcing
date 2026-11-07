import vine from '@vinejs/vine'
import { ADMIN_MAIL_STATUSES } from '#shared/types/admin_ops'
import { MAIL_KINDS } from '#shared/types/mail'

const KINDS = Object.values(MAIL_KINDS)

/** Filtres de la liste des envois (query string), tous optionnels. */
export const adminMailFiltersValidator = vine.create({
  status: vine.enum(ADMIN_MAIL_STATUSES).optional(),
  kind: vine.enum(KINDS).optional(),
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})

/** Rejeu groupé : un type de mail, ou tous si absent. */
export const adminMailRetryAllValidator = vine.create({
  kind: vine.enum(KINDS).optional(),
})
