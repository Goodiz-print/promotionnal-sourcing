import vine from '@vinejs/vine'
import { AGENCY_ACTIVITIES, CIVILITIES } from '#shared/types/agency'
import { COUNTRY_CODES } from '#shared/types/country'
import { SUPPORTED_LOCALES } from '#shared/types/i18n'

/**
 * Inscription agence. Seuls prénom, nom, email, mot de passe, société, pays,
 * identifiant fiscal et activité sont obligatoires, avec les deux cases
 * juridiques ; site web et téléphone restent facultatifs (sans site : validation
 * manuelle). L'identifiant fiscal est validé par `resolveTaxId` dans le service
 * et ici par une forme large (SIRET ou TVA).
 */
export const agencySignupValidator = vine.create({
  civility: vine.enum(CIVILITIES).optional().nullable(),
  firstName: vine.string().trim().minLength(1).maxLength(100),
  lastName: vine.string().trim().minLength(1).maxLength(100),
  email: vine
    .string()
    .trim()
    .email()
    .maxLength(254)
    .normalizeEmail()
    .unique({ table: 'users', column: 'email' }),
  password: vine
    .string()
    .minLength(10)
    .maxLength(72)
    .confirmed({ confirmationField: 'passwordConfirmation' }),
  companyName: vine.string().trim().minLength(2).maxLength(255),
  country: vine.enum(COUNTRY_CODES),
  taxId: vine
    .string()
    .trim()
    .regex(/^([A-Za-z]{2}[0-9A-Za-z .\-+*]{2,20}|[0-9 .\-]{14,20})$/),
  website: vine
    .string()
    .trim()
    .url({ require_protocol: false })
    .maxLength(500)
    .optional()
    .nullable(),
  phone: vine.string().trim().maxLength(30).optional().nullable(),
  activity: vine.enum(AGENCY_ACTIVITIES),
  activityOther: vine
    .string()
    .trim()
    .maxLength(255)
    .optional()
    .requiredWhen('activity', '=', 'other')
    .nullable(),
  locale: vine.enum(SUPPORTED_LOCALES),
  certifiesProfessional: vine.accepted(),
  acceptsTerms: vine.accepted(),
  acceptsPartnerCommunications: vine.boolean().optional(),
})
