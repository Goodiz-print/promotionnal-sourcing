import AdPaymentGateway from '#services/ads/ad_payment_gateway'
import { AdPaymentUnavailableException } from '#exceptions/ad_errors'

/** Prestataire inerte : aucun paiement en ligne (pas de `STRIPE_SECRET_KEY`). */
export default class NullAdPaymentGateway extends AdPaymentGateway {
  readonly enabled = false

  async createCheckout(): Promise<string> {
    throw new AdPaymentUnavailableException()
  }

  async confirmFromWebhook(): Promise<null> {
    return null
  }
}
