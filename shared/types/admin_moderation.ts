import type { ModerationDecision, ModerationStatus, ModerationTargetType } from './moderation.js'

/** Ancienneté minimale d'un élément de la file (en jours) proposée dans les filtres. */
export const MODERATION_AGE_FILTERS = [0, 7, 30] as const

export type ModerationAgeFilter = (typeof MODERATION_AGE_FILTERS)[number]

export type AdminModerationFilters = {
  /** `null` = tous les types. */
  type: ModerationTargetType | null
  status: ModerationStatus
  /** Éléments soumis depuis au moins ce nombre de jours (`0` = aucune borne). */
  minAgeDays: ModerationAgeFilter
}

/** Ligne de la file : un élément modérable et son statut courant. */
export type AdminModerationItem = {
  targetType: ModerationTargetType
  targetId: number
  label: string
  /** Contexte : organisation du fournisseur pour un produit. */
  subtitle: string | null
  status: ModerationStatus
  submittedAt: string
}

/** Entrée de l'historique d'un élément, la plus récente d'abord. */
export type AdminModerationHistoryItem = {
  id: number
  status: ModerationDecision
  reason: string | null
  decidedByEmail: string | null
  decidedAt: string
}

export type AdminModerationDetail = {
  item: AdminModerationItem
  history: AdminModerationHistoryItem[]
}

/** Nombre d'éléments en attente, par type (compteur du tableau de bord). */
export type AdminModerationPending = Record<ModerationTargetType, number>
