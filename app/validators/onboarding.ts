import vine from '@vinejs/vine'
import { ONBOARDING_TYPES } from '#shared/types/organization'

/**
 * Onboarding : création de la première organisation de l'utilisateur.
 * Le slug est dérivé du nom côté service (pas saisi par l'utilisateur).
 */
export const onboardingValidator = vine.create({
  name: vine.string().minLength(2).maxLength(255).trim(),
  organizationType: vine.enum(ONBOARDING_TYPES),
})
