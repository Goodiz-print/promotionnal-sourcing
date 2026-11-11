import type { Paginated } from './pagination.js'
import type { ProductType } from './product.js'

/**
 * Produits sponsorisés (cf. `docs/ads.md`) : un fournisseur paie au clic pour
 * faire remonter un produit. Tous les montants sont en **centimes d'euro**
 * (entiers) : aucune arithmétique flottante sur de l'argent.
 */
export const AD_CURRENCY = 'EUR'

/**
 * Statut d'une campagne :
 * - `active` : participe aux enchères (si dates, budget et solde le permettent) ;
 * - `paused` : mise en pause par le fournisseur ;
 * - `suspended` : arrêtée par l'équipe plateforme — le fournisseur ne peut pas
 *   la réactiver lui-même.
 */
export const AD_CAMPAIGN_STATUSES = ['active', 'paused', 'suspended'] as const

export type AdCampaignStatus = (typeof AD_CAMPAIGN_STATUSES)[number]

/** Emplacements où un produit sponsorisé peut apparaître. */
export const AD_PLACEMENTS = ['catalogue', 'product', 'home'] as const

export type AdPlacement = (typeof AD_PLACEMENTS)[number]

/** Nombre d'emplacements sponsorisés par écran. */
export const AD_SLOTS: Record<AdPlacement, number> = {
  catalogue: 3,
  product: 4,
  home: 4,
}

/** Prix plancher d'un clic (prix de réserve de l'enchère) et enchère maximale. */
export const AD_MIN_CPC_CENTS = 10
export const AD_MAX_CPC_CENTS = 5000

/** Bornes d'un budget quotidien et d'une recharge de portefeuille. */
export const AD_MIN_DAILY_BUDGET_CENTS = 100
export const AD_MAX_DAILY_BUDGET_CENTS = 1_000_000
export const AD_MIN_TOP_UP_CENTS = 1000
export const AD_MAX_TOP_UP_CENTS = 500_000

/**
 * Un même visiteur qui reclique sur la même campagne dans cette fenêtre n'est
 * facturé qu'une fois.
 */
export const AD_CLICK_DEDUP_HOURS = 24

/** Durée de validité du lien de clic signé (au-delà : redirection sans facturation). */
export const AD_CLICK_URL_TTL_HOURS = 12

export const AD_CLICK_SIGNATURE_PURPOSE = 'ad-click'

/**
 * Pourquoi un clic n'a pas été facturé. `null` sur un clic facturé.
 * - `duplicate` : même visiteur, même campagne, dans la fenêtre de dédoublonnage ;
 * - `own_organization` : clic d'un membre de l'organisation annonceuse ;
 * - `staff` : clic d'un membre de l'équipe plateforme ;
 * - `budget` : budget quotidien épuisé entre l'affichage et le clic ;
 * - `insufficient_funds` : solde du portefeuille insuffisant ;
 * - `inactive` : campagne arrêtée entre l'affichage et le clic.
 */
export const AD_UNBILLED_REASONS = [
  'duplicate',
  'own_organization',
  'staff',
  'budget',
  'insufficient_funds',
  'inactive',
] as const

export type AdUnbilledReason = (typeof AD_UNBILLED_REASONS)[number]

/**
 * Mouvement du portefeuille : recharge en ligne, crédit ou débit manuel de
 * l'équipe plateforme, clic facturé.
 */
export const AD_TRANSACTION_TYPES = ['top_up', 'adjustment', 'click'] as const

export type AdTransactionType = (typeof AD_TRANSACTION_TYPES)[number]

/** Campagne candidate à une enchère (entrée de `runAdAuction`). */
export interface AdAuctionCandidate {
  campaignId: number
  productId: number
  organizationId: number
  maxCpcCents: number
}

/** Campagne gagnante d'une enchère, avec le prix du clic. */
export interface AdAuctionWinner extends AdAuctionCandidate {
  costCents: number
}

/**
 * Produit sponsorisé affiché. `clickUrl` est un lien signé qui enregistre le
 * clic puis redirige vers la fiche ; le front ne construit jamais ce lien.
 * `type` (et non `interface`) : contrainte des props Inertia.
 */
export type SponsoredProductType = {
  product: ProductType
  clickUrl: string
}

/** Statistiques cumulées d'une campagne. */
export type AdCampaignStatsType = {
  impressions: number
  clicks: number
  billedClicks: number
  spentCents: number
}

export type AdCampaignType = {
  id: number
  productId: number
  productName: string
  productSlug: string
  productImageUrl: string | null
  /** Le produit est visible du catalogue (sinon la campagne ne diffuse pas). */
  productVisible: boolean
  status: AdCampaignStatus
  maxCpcCents: number
  dailyBudgetCents: number
  /** Dates ISO (`AAAA-MM-JJ`) ; `endsOn` nul = sans fin. */
  startsOn: string
  endsOn: string | null
  stats: AdCampaignStatsType
}

/** Produit de l'organisation pouvant être sponsorisé (liste du formulaire). */
export type AdProductOptionType = {
  id: number
  name: string
}

export type AdWalletTransactionType = {
  id: number
  type: AdTransactionType
  amountCents: number
  balanceAfterCents: number
  note: string | null
  createdAt: string
}

export type AdWalletType = {
  balanceCents: number
  /** Recharge en ligne disponible (clés Stripe configurées). */
  topUpEnabled: boolean
  transactions: AdWalletTransactionType[]
}

/** Champs saisis d'une campagne (création et modification). */
export interface AdCampaignInput {
  maxCpcCents: number
  dailyBudgetCents: number
  startsOn: string
  endsOn?: string | null
}

/** Ligne de la supervision des campagnes (back-office). */
export type AdminAdCampaignType = AdCampaignType & {
  organizationId: number
  organizationName: string
  walletBalanceCents: number
}

export type AdminAdCampaignsType = Paginated<AdminAdCampaignType>

/** Paiement confirmé par le prestataire : de quoi créditer un portefeuille. */
export interface AdPaymentConfirmation {
  /** Référence unique du paiement (idempotence du crédit). */
  reference: string
  organizationId: number
  amountCents: number
}

/** Demande de session de paiement pour une recharge. */
export interface AdCheckoutRequest {
  organizationId: number
  amountCents: number
  /** Libellé affiché sur la page de paiement. */
  label: string
  customerEmail: string | null
  successUrl: string
  cancelUrl: string
}
