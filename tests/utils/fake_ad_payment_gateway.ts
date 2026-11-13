import app from '@adonisjs/core/services/app'
import AdPaymentGateway from '#services/ads/ad_payment_gateway'
import type { AdCheckoutRequest, AdPaymentConfirmation } from '#shared/types/ads'

/**
 * Prestataire de paiement factice : enregistre les sessions demandées et
 * renvoie la confirmation qu'on lui a dit de renvoyer. Sert à vérifier la
 * recharge du portefeuille publicitaire sans Stripe.
 */
export default class FakeAdPaymentGateway extends AdPaymentGateway {
  enabled = true
  checkoutUrl = 'https://pay.test/session'
  checkouts: AdCheckoutRequest[] = []
  /** Réponse de `confirmFromWebhook` ; `Error` pour une signature invalide. */
  confirmation: AdPaymentConfirmation | null | Error = null

  async createCheckout(request: AdCheckoutRequest): Promise<string> {
    this.checkouts.push(request)
    return this.checkoutUrl
  }

  async confirmFromWebhook(): Promise<AdPaymentConfirmation | null> {
    if (this.confirmation instanceof Error) throw this.confirmation
    return this.confirmation
  }
}

/** Installe le prestataire factice ; `restore` est à appeler en fin de test. */
export function installFakeAdPaymentGateway(): {
  gateway: FakeAdPaymentGateway
  restore(): void
} {
  const gateway = new FakeAdPaymentGateway()
  app.container.swap(AdPaymentGateway, () => gateway)
  return { gateway, restore: () => app.container.restore(AdPaymentGateway) }
}
