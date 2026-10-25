import vine from '@vinejs/vine'
import db from '@adonisjs/lucid/services/db'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'

/** `meta.userId` : le compte modifié, exclu du contrôle d'unicité de l'email. */
export const updateAccountValidator = vine.withMetaData<{ userId: number }>().create({
  firstName: vine.string().trim().maxLength(100).nullable(),
  lastName: vine.string().trim().maxLength(100).nullable(),
  email: vine
    .string()
    .trim()
    .email()
    .maxLength(254)
    .unique(async (_, value, field) => {
      const row = await db
        .from('users')
        .whereNot('id', field.meta.userId)
        .whereRaw('lower(email) = ?', [value.toLowerCase()])
        .select('id')
        .first()
      return !row
    }),
  locale: vine.enum(SUPPORTED_LOCALES),
})

export const updatePasswordValidator = vine.create({
  currentPassword: vine.string(),
  password: vine
    .string()
    .minLength(8)
    .maxLength(32)
    .confirmed({ confirmationField: 'passwordConfirmation' })
    .notSameAs('currentPassword'),
})

export const destroyAccountValidator = vine.create({
  currentPassword: vine.string(),
})
