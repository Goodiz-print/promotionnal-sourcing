import type { RoleSlug } from '#shared/types/role'
import type { Component } from 'vue'
import type { KpiFormat } from '~/composables/use_kpi_format'
import type { BadgeTone } from '~/types/ui'
import type { KpiMetric } from '#shared/types/admin_kpi'

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
  value: number | string
  extra?: string | number
}

/** Indicateur d'un groupe du tableau de bord KPI (`KpiGroup`) : valeur comparée à la période précédente. */
export interface KpiItem {
  key: string
  label: string
  metric: KpiMetric
  format: KpiFormat
  icon: Component
}

/** Valeurs des filtres des écrans de supervision (demandes, devis, commandes) ; `null` = filtre inactif. */
export interface TradeFilterValues {
  status: string | null
  attention: string | null
  buyer: string | null
  supplier: string | null
  from: string | null
  to: string | null
}

/** Ligne chiffrée d'un devis ou d'une commande (`TradeLinesTable`). */
export interface TradeLine {
  id: number
  name: string
  quantity: number
  unitPrice: string
  totalPrice: string
  leadTimeDays?: number
}
