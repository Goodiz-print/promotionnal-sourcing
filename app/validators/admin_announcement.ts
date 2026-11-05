import vine from '@vinejs/vine'
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_BODY_MAX_LENGTH,
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
} from '#shared/types/announcement'

/** Le titre sert d'objet de mail : une seule ligne. */
const SINGLE_LINE = /^[^\r\n]+$/

export const ANNOUNCEMENT_CHANNELS = ['inApp', 'email'] as const

/** Historique : pagination seule. */
export const adminAnnouncementFiltersValidator = vine.create({
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})

/**
 * Nouvelle annonce. Le français est obligatoire (langue source) ; l'anglais est
 * facultatif mais titre et texte vont ensemble. L'envoi doit être confirmé : un
 * segment entier est destinataire.
 */
export const adminAnnouncementValidator = vine.create({
  audience: vine.enum(ANNOUNCEMENT_AUDIENCES),
  organizationId: vine
    .number()
    .withoutDecimals()
    .min(1)
    .optional()
    .requiredWhen('audience', '=', 'organization'),
  channels: vine.array(vine.enum(ANNOUNCEMENT_CHANNELS)).minLength(1).distinct(),
  titleFr: vine
    .string()
    .trim()
    .minLength(1)
    .maxLength(ANNOUNCEMENT_TITLE_MAX_LENGTH)
    .regex(SINGLE_LINE),
  bodyFr: vine.string().trim().minLength(1).maxLength(ANNOUNCEMENT_BODY_MAX_LENGTH),
  titleEn: vine
    .string()
    .trim()
    .maxLength(ANNOUNCEMENT_TITLE_MAX_LENGTH)
    .regex(SINGLE_LINE)
    .optional()
    .requiredIfExists('bodyEn'),
  bodyEn: vine
    .string()
    .trim()
    .maxLength(ANNOUNCEMENT_BODY_MAX_LENGTH)
    .optional()
    .requiredIfExists('titleEn'),
  confirm: vine.accepted(),
})
