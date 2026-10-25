/**
 * Activité déclarée par une agence à l'inscription (réservé aux professionnels
 * du secteur). `other` impose une validation manuelle et une précision libre.
 */
export const AGENCY_ACTIVITIES = [
  'object_communication_agency',
  'distributor_reseller',
  'printer_marker',
  'communication_events_agency',
  'other',
] as const

export type AgencyActivity = (typeof AGENCY_ACTIVITIES)[number]

/** Taille de l'équipe (anonymisée dans les statistiques fournisseurs en gratuit). */
export const AGENCY_TEAM_SIZES = ['solo', 'from_2_to_10', 'from_11_to_50', 'over_50'] as const

export type AgencyTeamSize = (typeof AGENCY_TEAM_SIZES)[number]

/**
 * Tranches de volume d'achat annuel — jamais affichées publiquement, elles
 * qualifient le lead pour les fournisseurs payants. Seule la tranche
 * « 100-500 k€ » figure en exemple dans le classeur de collecte : les bornes
 * sont à confirmer avec Virgile.
 */
export const AGENCY_PURCHASE_VOLUMES = [
  'under_50k',
  'from_50k_to_100k',
  'from_100k_to_500k',
  'from_500k_to_1m',
  'over_1m',
] as const

export type AgencyPurchaseVolume = (typeof AGENCY_PURCHASE_VOLUMES)[number]

export const AGENCY_CLIENT_SECTORS = [
  'public_bodies',
  'smes',
  'key_accounts',
  'associations',
  'events',
] as const

export type AgencyClientSector = (typeof AGENCY_CLIENT_SECTORS)[number]

/** Civilité facultative d'un utilisateur (emails). */
export const CIVILITIES = ['madame', 'monsieur'] as const

export type Civility = (typeof CIVILITIES)[number]

export type AgencyProfileType = {
  id: number
  organizationId: number
  activity: AgencyActivity
  activityOther: string | null
  teamSize: AgencyTeamSize | null
  purchaseVolume: AgencyPurchaseVolume | null
  clientSectors: AgencyClientSector[] | null
  defaultMarginPercent: number | null
  createdAt: string
  updatedAt: string | null
}

export interface UpdateAgencyProfileData {
  activity?: AgencyActivity
  activityOther?: string | null
  teamSize?: AgencyTeamSize | null
  purchaseVolume?: AgencyPurchaseVolume | null
  clientSectors?: AgencyClientSector[] | null
  defaultMarginPercent?: number | null
}
