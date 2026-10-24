import type { RfqStatus } from './rfq.js'

/**
 * Types du tableau de bord applicatif (`dashboard.show`). Déclarés en `type`
 * (et non `interface`) pour rester assignables à `Record<string, JSONDataTypes>`
 * — contrainte de typage des props Inertia.
 */

/** Nombre de demandes de devis de l'acheteur, par statut. */
export type BuyerRfqCountsType = Record<RfqStatus, number>

/** Réponse récente d'un fournisseur à une demande de l'acheteur. */
export type BuyerRecentResponseType = {
  rfqId: number
  rfqTitle: string
  supplierName: string
  respondedAt: string
}

export type BuyerDashboardType = {
  rfqCounts: BuyerRfqCountsType
  recentResponses: BuyerRecentResponseType[]
}

export type SupplierDashboardType = {
  /** Demandes reçues que le fournisseur n'a pas encore ouvertes (statut `sent`). */
  unreadRfqs: number
  activeProducts: number
  /** Pourcentage (0-100) de champs de profil fournisseur renseignés. */
  profileCompleteness: number
}

/**
 * Chaque bloc n'est présent que si le type de l'organisation courante le
 * justifie (`buyer`/`both` → `buyer`, `supplier`/`both` → `supplier`).
 */
export type DashboardType = {
  buyer?: BuyerDashboardType
  supplier?: SupplierDashboardType
}
