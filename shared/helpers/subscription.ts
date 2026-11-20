import { SUBSCRIPTION_TIMEZONE, type SubscriptionStatus } from '../types/subscription.js'

/**
 * Traduit le statut Stripe d'un abonnement en statut de la plateforme
 * (cf. `docs/abonnements.md`) :
 * - `active`, `trialing` → `active` ;
 * - `past_due` → `past_due` : impayé en cours de relance, la formule est conservée ;
 * - `incomplete` → `pending` : premier paiement non abouti, aucun droit ;
 * - `paused` → `cancelled` tant qu'il est en pause (aucun droit) ;
 * - `unpaid`, `canceled`, `incomplete_expired` et tout statut inconnu → `cancelled`.
 *
 * Un abonnement `unpaid` qui est finalement réglé redevient `active` à la
 * notification suivante : la ligne est relue, pas figée.
 */
export function statusFromProvider(providerStatus: string): SubscriptionStatus {
  switch (providerStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'incomplete':
      return 'pending'
    default:
      return 'cancelled'
  }
}

/**
 * La notification concerne-t-elle un abonnement (`customer.subscription.*`,
 * `invoice.*`) ? Les autres types (recharges publicitaires…) sont ignorés.
 */
export function isSubscriptionEventType(type: string): boolean {
  return type.startsWith('customer.subscription.') || type.startsWith('invoice.')
}

/**
 * Dernier jour couvert par un abonnement, au format `AAAA-MM-JJ` (heure de
 * Paris). `ends_at` est exclusif : il pointe sur le début du jour qui suit.
 */
export function lastCoveredDay(endsAt: string): string {
  return dayInSubscriptionZone(new Date(Date.parse(endsAt) - 1))
}

/**
 * Jour d'un instant au format `AAAA-MM-JJ`, heure de Paris (aujourd'hui par
 * défaut). Le format suédois est l'ISO `AAAA-MM-JJ`.
 */
export function dayInSubscriptionZone(instant: Date = new Date()): string {
  return instant.toLocaleDateString('sv-SE', { timeZone: SUBSCRIPTION_TIMEZONE })
}
