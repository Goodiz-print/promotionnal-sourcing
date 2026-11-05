import vine from '@vinejs/vine'
import { AI_TRANSLATION_MAX_LENGTH, AI_TRANSLATION_ORIGINS } from '#shared/types/admin_ai'
import { TRANSLATABLE_ENTITIES } from '#shared/types/ai'
import { TRANSLATION_LOCALES } from '#shared/types/i18n'

/** Filtres de la relecture des traductions (query string). */
export const adminAiTranslationFiltersValidator = vine.create({
  entity: vine.enum(TRANSLATABLE_ENTITIES).optional(),
  locale: vine.enum(TRANSLATION_LOCALES).optional(),
  origin: vine.enum(AI_TRANSLATION_ORIGINS).optional(),
  search: vine.string().trim().maxLength(100).optional(),
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})

/** Rattrapage : types à traiter (tous si absent). */
export const adminAiBackfillValidator = vine.create({
  entity: vine.enum(TRANSLATABLE_ENTITIES).optional(),
})

/**
 * Correction d'une traduction : les champs admis dépendent de l'entité, le
 * service les contrôle (`name` / `description` / `label`). Un champ vidé arrive
 * `null` (le body parser convertit les chaînes vides).
 */
export const adminAiCorrectionValidator = vine.create({
  name: vine.string().trim().maxLength(AI_TRANSLATION_MAX_LENGTH).optional().nullable(),
  description: vine.string().trim().maxLength(AI_TRANSLATION_MAX_LENGTH).optional().nullable(),
  label: vine.string().trim().maxLength(AI_TRANSLATION_MAX_LENGTH).optional().nullable(),
})
