import vine from '@vinejs/vine'
import {
  CONTACT_FIELD_LIMITS,
  CONTACT_HONEYPOT_FIELD,
  CONTACT_REQUEST_TYPES,
} from '#shared/types/marketing'

/**
 * Formulaire de contact de la landing. Le champ piège (`botField`) n'est pas
 * validé : le contrôleur le lit tel quel pour faire semblant de réussir.
 */
export const contactRequestValidator = vine.create({
  type: vine.enum(CONTACT_REQUEST_TYPES),
  name: vine.string().trim().minLength(1).maxLength(CONTACT_FIELD_LIMITS.name),
  company: vine.string().trim().minLength(1).maxLength(CONTACT_FIELD_LIMITS.company),
  email: vine.string().trim().email().maxLength(CONTACT_FIELD_LIMITS.email).normalizeEmail(),
  phone: vine.string().trim().maxLength(CONTACT_FIELD_LIMITS.phone).optional(),
  message: vine.string().trim().minLength(1).maxLength(CONTACT_FIELD_LIMITS.message),
  [CONTACT_HONEYPOT_FIELD]: vine.string().optional(),
})
