import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import { INBOUND_MAIL_REJECTIONS, INBOUND_MAIL_STATUSES } from '#shared/types/inbound_mail'

const ID_MAX = 2147483647

/** Filtres de la liste des mails entrants (query string), tous optionnels. */
export const adminInboundMailFiltersValidator = vine.create({
  status: vine.enum(Object.values(INBOUND_MAIL_STATUSES)).optional(),
  rejection: vine.enum(Object.values(INBOUND_MAIL_REJECTIONS)).optional(),
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})

/** Fiche d'un mail : numéro de demande pour chercher où le rattacher. */
export const adminInboundMailShowValidator = vine.create({
  rfq: vine.number().withoutDecimals().min(1).max(ID_MAX).optional(),
})

/** Rattachement manuel : un couple demande / fournisseur existant. */
export const adminInboundMailAttachValidator = vine.create({
  rfqSupplierId: vine
    .number()
    .withoutDecimals()
    .min(1)
    .max(ID_MAX)
    .exists(async (_, value) => {
      const row = await db.from('rfq_suppliers').where('id', value).select('id').first()
      return !!row
    }),
})
