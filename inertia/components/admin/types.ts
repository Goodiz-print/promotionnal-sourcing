import type { RoleSlug } from '#shared/types/role'
import type { BadgeTone } from '~/types/ui'

/**
 * Tonalité de la pastille par rôle d'organisation (back-office). Le propriétaire
 * porte la marque, l'administrateur attire l'œil, les autres restent neutres.
 */
export const ORGANIZATION_ROLE_TONES: Record<RoleSlug, BadgeTone | 'brand'> = {
  owner: 'brand',
  admin: 'info',
  manager: 'neutral',
  member: 'neutral',
}
