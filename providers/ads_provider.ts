import type { ApplicationService } from '@adonisjs/core/types'
import adsConfig from '#config/ads'
import AdPaymentGateway from '#services/ads/ad_payment_gateway'
import NullAdPaymentGateway from '#services/ads/null_ad_payment_gateway'
import StripeAdPaymentGateway from '#services/ads/stripe_ad_payment_gateway'

/**
 * Lie le prestataire de paiement des recharges publicitaires : Stripe quand
 * `STRIPE_SECRET_KEY` est défini, prestataire inerte sinon (dev, test, CI).
 */
export default class AdsProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(AdPaymentGateway, async (resolver) => {
      return resolver.make(
        adsConfig.payment.enabled ? StripeAdPaymentGateway : NullAdPaymentGateway
      )
    })
  }
}
