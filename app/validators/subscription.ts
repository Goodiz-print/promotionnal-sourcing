import vine from '@vinejs/vine'
import { PAID_SUBSCRIPTION_PLANS } from '#shared/types/subscription'

/** Souscription en ligne : formule payante choisie sur la page tarifs. */
export const subscriptionCheckoutValidator = vine.create({
  plan: vine.enum(PAID_SUBSCRIPTION_PLANS),
})
