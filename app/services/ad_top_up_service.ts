import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import AdPaymentGateway from '#services/ads/ad_payment_gateway'
import AdWalletService from '#services/ad_wallet_service'
import type { AdCheckoutRequest } from '#shared/types/ads'

/**
 * Recharge en ligne d'un portefeuille publicitaire (cf. `docs/ads.md`) :
 * ouverture de la page de paiement, puis crédit à la confirmation signée du
 * prestataire.
 */
@inject()
export default class AdTopUpService {
  constructor(
    private gateway: AdPaymentGateway,
    private wallets: AdWalletService
  ) {}

  /** La recharge en ligne est-elle proposée ? */
  get enabled(): boolean {
    return this.gateway.enabled
  }

  /** URL de la page de paiement hébergée pour cette recharge. */
  checkoutUrl(request: AdCheckoutRequest): Promise<string> {
    return this.gateway.createCheckout(request)
  }

  /**
   * Notification du prestataire. Crédite le portefeuille si elle confirme une
   * recharge payée ; **idempotent** — une notification rejouée ne crédite pas
   * deux fois (référence unique du paiement). Lève si la signature est invalide.
   */
  async handleWebhook(rawBody: string, signature: string | undefined): Promise<void> {
    const payment = await this.gateway.confirmFromWebhook(rawBody, signature)
    if (!payment) return

    const transaction = await this.wallets.apply(payment.organizationId, payment.amountCents, {
      type: 'top_up',
      externalReference: payment.reference,
    })
    logger.info(
      { organizationId: payment.organizationId, amountCents: payment.amountCents },
      transaction ? 'ad wallet topped up' : 'ad wallet top-up already applied'
    )
  }
}
