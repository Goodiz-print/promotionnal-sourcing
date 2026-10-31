import vine from '@vinejs/vine'
import { PLATFORM_ROLES } from '#shared/types/user'

/**
 * Changement du rôle plateforme d'un compte (écran Utilisateurs du back-office).
 */
export const updatePlatformRoleValidator = vine.create({
  platformRole: vine.enum(PLATFORM_ROLES),
})
