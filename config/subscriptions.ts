import env from '#start/env'
import type { PaidSubscriptionPlan } from '#shared/types/subscription'

/**
 * Souscription en ligne des abonnements fournisseurs (cf. `docs/abonnements.md`).
 * **Désactivée** tant que `STRIPE_SECRET_KEY` et les deux prix
 * (`STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_PREMIUM`) ne sont pas tous définis :
 * l'abonnement reste alors saisi par l'équipe plateforme.
 */
const stripeSecretKey = env.get('STRIPE_SECRET_KEY')?.release() ?? null

const prices: Record<PaidSubscriptionPlan, string | null> = {
  business: env.get('STRIPE_PRICE_BUSINESS') ?? null,
  premium: env.get('STRIPE_PRICE_PREMIUM') ?? null,
}

const subscriptionsConfig = {
  billing: {
    enabled: Boolean(stripeSecretKey && prices.business && prices.premium),
    stripeSecretKey,
    stripeWebhookSecret: env.get('STRIPE_WEBHOOK_SECRET')?.release() ?? null,
    prices,
  },
}

export default subscriptionsConfig
