import vine from '@vinejs/vine'
import { PAID_SUBSCRIPTION_PLANS } from '#shared/types/subscription'

/**
 * Jour calendaire `AAAA-MM-JJ`, gardé en texte : il est interprété à l'heure de
 * Paris par `ManualSubscriptionService` (une `Date` porterait le fuseau du serveur).
 */
const day = () =>
  vine
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)

/**
 * Saisie d'un abonnement manuel par l'admin (#214). La cohérence des dates
 * (fin après le début, fin non passée) est vérifiée par le service.
 */
export const adminSubscriptionCreateValidator = vine.create({
  plan: vine.enum(PAID_SUBSCRIPTION_PLANS),
  startsOn: day(),
  endsOn: day(),
})

/** Nouvelle date de fin (jour inclus) d'un abonnement manuel ouvert. */
export const adminSubscriptionExtendValidator = vine.create({
  endsOn: day(),
})
