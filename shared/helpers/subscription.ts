import {
  ANNUAL_SUBSCRIPTION_MIN_MONTHS,
  SUBSCRIPTION_REMINDER_DAYS,
  SUBSCRIPTION_TIMEZONE,
  type SubscriptionReminderState,
  type SubscriptionStatus,
  type SubscriptionUpsellType,
} from '../types/subscription.js'

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

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Abonnement annuel : au moins `ANNUAL_SUBSCRIPTION_MIN_MONTHS` mois entre son
 * début et sa fin (exclusive). Un abonnement du 1er janvier au 31 décembre
 * inclus est donc annuel.
 */
export function isAnnualSubscription(startsAt: string, endsAt: string): boolean {
  const threshold = new Date(startsAt)
  threshold.setUTCMonth(threshold.getUTCMonth() + ANNUAL_SUBSCRIPTION_MIN_MONTHS)
  return Date.parse(endsAt) >= threshold.getTime()
}

/**
 * Rappel d'échéance dû à l'instant `now` (#237), en jours avant la fin, ou
 * `null` si aucun n'est dû :
 * - délais `SUBSCRIPTION_REMINDER_DAYS` (30 et 7 jours pour un annuel, 7 sinon),
 *   en ignorant un délai plus long que l'abonnement lui-même ;
 * - parmi les délais atteints, le plus proche de la fin : un job qui aurait
 *   manqué le rappel à 30 jours n'envoie que celui à 7 jours ;
 * - rien si ce rappel (ou un plus proche) est déjà parti **pour cette date de
 *   fin** : une prolongation fait repartir les rappels pour la nouvelle date.
 */
export function dueReminderDays(state: SubscriptionReminderState, now: Date): number | null {
  const endsAt = Date.parse(state.endsAt)
  const left = endsAt - now.getTime()
  const duration = endsAt - Date.parse(state.startsAt)
  if (left <= 0) return null

  const schedule = isAnnualSubscription(state.startsAt, state.endsAt)
    ? SUBSCRIPTION_REMINDER_DAYS.annual
    : SUBSCRIPTION_REMINDER_DAYS.monthly
  const reached = schedule.filter((days) => days * DAY_MS < duration && left <= days * DAY_MS)
  if (reached.length === 0) return null

  const days = Math.min(...reached)
  const sameEnd = state.remindedEndsAt !== null && Date.parse(state.remindedEndsAt) === endsAt
  const alreadySent = sameEnd && state.remindedDays !== null && state.remindedDays <= days
  return alreadySent ? null : days
}

/**
 * Encart « abonnez-vous » (#222) d'un écran fournisseur : `null` pour un abonné,
 * sinon le droit de souscrire (`canSubscribe`, l'ability `canManageSubscription`),
 * évalué seulement pour un non abonné.
 */
export async function subscriptionUpsell(
  subscribed: boolean,
  canSubscribe: () => Promise<boolean>
): Promise<SubscriptionUpsellType | null> {
  if (subscribed) return null
  return { canSubscribe: await canSubscribe() }
}
