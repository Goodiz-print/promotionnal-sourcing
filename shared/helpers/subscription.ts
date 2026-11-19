import type { SubscriptionStatus } from '../types/subscription.js'

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
