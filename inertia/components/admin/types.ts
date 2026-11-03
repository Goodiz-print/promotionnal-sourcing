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

/** Ligne d'un classement de l'écran « Ce que cherchent les clients » (`DemandRanking`). */
export interface RankingRow {
  key: string | number
  label: string
  value: number
  extra?: string | number
}
