import type { Locale } from './i18n.js'
import type { SubscriptionPlan } from './organization.js'

/**
 * Abonnements des organisations (cf. `docs/abonnements.md`). La formule
 * courante est dénormalisée dans `organizations.subscription_plan` ; elle n'est
 * écrite que par `SubscriptionService`.
 */

/** Formules payantes : `free` n'est jamais un abonnement, c'est l'absence d'abonnement. */
export const PAID_SUBSCRIPTION_PLANS = ['business', 'premium'] as const

export type PaidSubscriptionPlan = (typeof PAID_SUBSCRIPTION_PLANS)[number]

/**
 * Prix mensuels affichés sur la page tarifs, en centimes d'euro HT. Affichage
 * seulement : le montant facturé est celui du prix Stripe configuré
 * (`STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_PREMIUM`).
 */
export const SUBSCRIPTION_MONTHLY_PRICES_CENTS: Record<PaidSubscriptionPlan, number> = {
  business: 25_000,
  premium: 50_000,
}

/**
 * Statut d'un abonnement :
 * - `scheduled` : date de début future (saisie manuelle) ;
 * - `pending` : premier paiement en attente (Stripe `incomplete`) — aucun droit ;
 * - `active` : en cours, payé ;
 * - `past_due` : échéance impayée, Stripe relance — la formule est **conservée**
 *   pendant les relances ;
 * - `expired` : terminé à sa date de fin ;
 * - `cancelled` : résilié, ou abandonné par Stripe après impayé.
 */
export const SUBSCRIPTION_STATUSES = [
  'scheduled',
  'pending',
  'active',
  'past_due',
  'expired',
  'cancelled',
] as const

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/** Statuts qui ouvrent les droits de la formule (un seul par organisation, contrainte en base). */
export const CURRENT_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ['active', 'past_due']

/**
 * Statuts qui bloquent une nouvelle souscription en ligne : un abonnement en
 * cours, ou un premier paiement encore en validation (3-D Secure, prélèvement)
 * qui peut aboutir — en ouvrir un second ferait payer deux abonnements.
 */
export const BLOCKING_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  ...CURRENT_SUBSCRIPTION_STATUSES,
  'pending',
]

/**
 * Durée de conservation des notifications Stripe traitées (idempotence). Stripe
 * renvoie une notification pendant 3 jours au plus : 30 jours laissent une marge
 * large, au-delà la ligne ne sert plus.
 */
export const STRIPE_WEBHOOK_EVENT_RETENTION_DAYS = 30

/** Origine d'un abonnement. Colonne libre : en ajouter une ne demande pas de migration. */
export const SUBSCRIPTION_ORIGINS = ['manual', 'stripe'] as const

export type SubscriptionOrigin = (typeof SUBSCRIPTION_ORIGINS)[number]

/**
 * État d'un abonnement chez le prestataire de paiement, relu à chaque
 * notification (jamais déduit du contenu de la notification : l'ordre d'arrivée
 * des webhooks n'est pas garanti).
 */
export interface BillingSubscriptionSnapshot {
  id: string
  customerId: string
  /** Statut brut du prestataire (`active`, `past_due`, `canceled`…). */
  providerStatus: string
  /** Formule du prix souscrit ; `null` si le prix n'est pas une formule connue. */
  plan: PaidSubscriptionPlan | null
  /** Organisation portée par les métadonnées de l'abonnement, si présente. */
  organizationId: number | null
  currentPeriodStart: Date
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
}

/**
 * Notification du prestataire, réduite à ce qui sert : son identifiant (pour
 * l'idempotence) et l'abonnement qu'elle concerne.
 */
export interface BillingWebhookEvent {
  id: string
  type: string
  subscriptionId: string
}

/**
 * Issue de l'alignement d'un abonnement sur l'état du prestataire :
 * - `synced` : ligne locale à jour ;
 * - `ignored` : organisation ou formule introuvable, rien n'est écrit ;
 * - `conflict` : l'abonnement devient courant alors qu'un **autre abonnement en
 *   ligne** est déjà en cours pour l'organisation — rien n'est écrit, l'appelant
 *   arbitre (cf. `SubscriptionBillingService`).
 */
export type SubscriptionSyncResult<Row> =
  | { outcome: 'synced'; subscription: Row }
  | { outcome: 'ignored' }
  | { outcome: 'conflict'; current: Row & { stripeSubscriptionId: string } }

/**
 * Doublon d'abonnement en ligne résilié chez Stripe : son paiement est à
 * rembourser par l'équipe plateforme, prévenue par une notification.
 */
export interface DuplicateSubscriptionCancelled {
  organizationId: number
  keptSubscriptionId: string
  cancelledSubscriptionId: string
}

/** Ouverture d'une page de souscription hébergée. */
export interface SubscriptionCheckoutRequest {
  organizationId: number
  customerId: string
  plan: PaidSubscriptionPlan
  successUrl: string
  cancelUrl: string
}

/** Création du client chez le prestataire. */
export interface BillingCustomerRequest {
  organizationId: number
  name: string
  email: string | null
}

/** Ce que le fournisseur voit de son abonnement (page `supplier/subscription`). */
export type CurrentSubscriptionType = {
  plan: PaidSubscriptionPlan
  status: SubscriptionStatus
  origin: string
  startsAt: string
  endsAt: string | null
  cancelAtPeriodEnd: boolean
}

/** Props de la page tarifs et abonnement côté fournisseur. */
export type SupplierSubscriptionPageProps = {
  currentPlan: SubscriptionPlan
  subscription: CurrentSubscriptionType | null
  /** Souscription en ligne configurée (clé Stripe + prix). */
  onlineEnabled: boolean
  /** Un client Stripe existe : le portail de facturation est accessible. */
  portalAvailable: boolean
  /** Retour de la page de paiement. */
  checkoutStatus: 'success' | 'cancelled' | null
}

/**
 * Grille des formules affichée sur la page tarifs (#214). Chaque ligne est
 * traduite par formule (`subscription.features.<clé>.<formule>`) ; `included`
 * coche ou barre la ligne.
 */
export const SUBSCRIPTION_FEATURES = [
  'catalogue',
  'statistics',
  'quoteRequests',
  'competitors',
  'ranking',
  'superboost',
  'support',
] as const

export type SubscriptionFeature = (typeof SUBSCRIPTION_FEATURES)[number]

export const SUBSCRIPTION_FEATURE_INCLUDED: Record<
  SubscriptionFeature,
  Record<SubscriptionPlan, boolean>
> = {
  catalogue: { free: true, business: true, premium: true },
  statistics: { free: false, business: true, premium: true },
  quoteRequests: { free: false, business: true, premium: true },
  competitors: { free: false, business: true, premium: true },
  ranking: { free: false, business: true, premium: true },
  superboost: { free: false, business: false, premium: true },
  support: { free: false, business: false, premium: true },
}

/**
 * Fuseau des dates d'abonnement saisies par l'admin : un abonnement court du
 * début du jour de début à la fin du jour de fin, heure de Paris.
 */
export const SUBSCRIPTION_TIMEZONE = 'Europe/Paris'

/**
 * Abonnement saisi à la main par l'admin (#214). Dates au format `YYYY-MM-DD`,
 * jour de fin **inclus**. Un jour de début futur programme l'abonnement.
 */
export interface ManualSubscriptionInput {
  organizationId: number
  plan: PaidSubscriptionPlan
  startsOn: string
  endsOn: string
  authorId: number | null
}

/** Abonnement visé par une action admin, avec l'organisation de l'URL. */
export interface ManualSubscriptionTarget {
  organizationId: number
  subscriptionId: number
}

/** Nouvelle date de fin (`AAAA-MM-JJ`, jour inclus) d'un abonnement manuel. */
export interface ManualSubscriptionExtension extends ManualSubscriptionTarget {
  endsOn: string
}

/** Passage planifié sur les abonnements manuels : identifiants activés et expirés. */
export interface SubscriptionSyncDueResult {
  activated: number[]
  expired: number[]
}

/**
 * Rappels avant la fin d'un abonnement manuel (#237), en jours : 7 jours pour
 * tout abonnement, 30 jours en plus pour un abonnement annuel. Du plus tôt au
 * plus tard.
 */
export const SUBSCRIPTION_REMINDER_DAYS = { monthly: [7], annual: [30, 7] } as const

/**
 * Durée minimale, en mois, d'un abonnement considéré comme annuel. Saisi à la
 * main, un abonnement n'a pas de périodicité de facturation : on la déduit de
 * sa durée.
 */
export const ANNUAL_SUBSCRIPTION_MIN_MONTHS = 12

/**
 * Abonnement lu par `SubscriptionMailService` (#237), en colonnes brutes : le
 * service passe par `db` (sans modèle Lucid) pour être injectable dans un job.
 */
export interface SubscriptionMailRow {
  id: number
  organization_id: number
  organization_name: string
  plan: PaidSubscriptionPlan
  starts_at: Date
  ends_at: Date | null
  reminded_ends_at: Date | null
  reminded_days: number | null
}

/** Rappel d'échéance dû : l'abonnement et le délai (jours avant la fin). */
export interface DueSubscriptionReminder {
  subscription: SubscriptionMailRow
  days: number
}

/** Destinataire d'un mail d'abonnement : un responsable de l'organisation. */
export interface SubscriptionMailRecipient {
  email: string
  locale: Locale
}

/** État d'un abonnement utile au calcul du rappel dû (instants en ISO). */
export interface SubscriptionReminderState {
  startsAt: string
  endsAt: string
  /** Date de fin pour laquelle le dernier rappel a été envoyé. */
  remindedEndsAt: string | null
  /** Délai (en jours) du dernier rappel envoyé pour `remindedEndsAt`. */
  remindedDays: number | null
}
