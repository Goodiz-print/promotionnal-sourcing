import env from '#start/env'

/**
 * Produits sponsorisés (cf. `docs/ads.md`). La recharge en ligne du
 * portefeuille passe par Stripe Checkout ; **désactivée sans
 * `STRIPE_SECRET_KEY`** (dev, test, CI) — les campagnes fonctionnent quand
 * même, les portefeuilles étant alors crédités depuis le back-office.
 */
const stripeSecretKey = env.get('STRIPE_SECRET_KEY')?.release() ?? null

const adsConfig = {
  payment: {
    enabled: Boolean(stripeSecretKey),
    stripeSecretKey,
    stripeWebhookSecret: env.get('STRIPE_WEBHOOK_SECRET')?.release() ?? null,
  },
}

export default adsConfig
