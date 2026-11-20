import { DateTime } from 'luxon'
import { SUBSCRIPTION_TIMEZONE } from '../types/subscription.js'

/**
 * Période d'un abonnement saisi en jours (#214). Côté serveur uniquement (Luxon) :
 * le front passe par `dayInSubscriptionZone` / `lastCoveredDay`
 * (`shared/helpers/subscription.ts`).
 *
 * Un abonnement court du **début** de son premier jour à la **fin** de son
 * dernier jour, heure de Paris (`SUBSCRIPTION_TIMEZONE`). La fin est stockée
 * exclusive : début du jour qui suit le dernier jour couvert.
 */

/** Début (00:00, heure de Paris) du jour `AAAA-MM-JJ`. Invalide si le jour l'est. */
export function subscriptionDayStart(day: string): DateTime {
  return DateTime.fromISO(day, { zone: SUBSCRIPTION_TIMEZONE }).startOf('day')
}

/** Fin exclusive d'un dernier jour inclus : le début du jour suivant. */
export function subscriptionDayEnd(day: string): DateTime {
  return subscriptionDayStart(day).plus({ days: 1 })
}

/**
 * Période acceptable : deux dates valides, une fin après le début et pas encore
 * passée à l'instant `now`.
 */
export function isValidSubscriptionPeriod(
  startsAt: DateTime,
  endsAt: DateTime,
  now: DateTime = DateTime.now()
): boolean {
  if (!startsAt.isValid || !endsAt.isValid) return false
  return endsAt > startsAt && endsAt > now
}
