import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import { COUNTRY_CODES } from '#shared/types/country'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'
import { SUPPLIER_CONTACT_MOVES } from '#shared/types/supplier'

/**
 * Saisie d'un contact commercial (#241). `meta.organizationId` : le fournisseur
 * courant — un contact ne peut relier qu'un membre de **son** compte.
 * `countries` vide : le contact couvre tous les pays.
 */
export const supplierContactValidator = vine.withMetaData<{ organizationId: number }>().create({
  name: vine.string().trim().minLength(1).maxLength(255),
  jobTitle: vine.string().trim().maxLength(255).optional().nullable(),
  email: vine.string().trim().email().maxLength(254),
  phone: vine.string().trim().maxLength(30).optional().nullable(),
  languages: vine
    .array(vine.enum(SUPPORTED_LOCALES))
    .maxLength(SUPPORTED_LOCALES.length)
    .optional(),
  countries: vine
    .array(
      vine
        .string()
        .trim()
        .toUpperCase()
        .in([...COUNTRY_CODES])
    )
    .maxLength(COUNTRY_CODES.length)
    .optional(),
  userId: vine
    .number()
    .withoutDecimals()
    .exists(async (_, value, field) => {
      const row = await db
        .from('organization_users')
        .where('organization_id', field.meta.organizationId)
        .where('user_id', value)
        .select('user_id')
        .first()
      return !!row
    })
    .optional()
    .nullable(),
})

/** Option « montrer toute l'équipe à toutes les agences ». */
export const supplierContactSettingsValidator = vine.create({
  showAllContacts: vine.boolean(),
})

/** Déplacement d'un contact dans l'ordre d'affichage. */
export const supplierContactMoveValidator = vine.create({
  direction: vine.enum(SUPPLIER_CONTACT_MOVES),
})
