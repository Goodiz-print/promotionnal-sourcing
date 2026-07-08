import vine from '@vinejs/vine'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'

export const updateLocaleValidator = vine.create({
  locale: vine.enum(SUPPORTED_LOCALES),
})
