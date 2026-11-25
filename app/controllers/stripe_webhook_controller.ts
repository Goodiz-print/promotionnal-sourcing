import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import AdTopUpService from '#services/ad_top_up_service'
import SubscriptionBillingService from '#services/subscription_billing_service'

/**
 * Notifications de paiement de Stripe : recharges de portefeuille publicitaire
 * (cf. `docs/ads.md`) et abonnements fournisseurs (cf. `docs/abonnements.md`).
 * Chaque service ne retient que les événements qui le concernent. Vraie route d'API : hors locale, hors session, exemptée
 * de CSRF — l'appelant est authentifié par la **signature** de la notification,
 * vérifiée sur le corps brut. Répond en JSON, comme Stripe l'attend.
 */
@inject()
export default class StripeWebhookController {
  constructor(
    private topUps: AdTopUpService,
    private subscriptions: SubscriptionBillingService
  ) {}

  async store({ request, response }: HttpContext) {
    try {
      const rawBody = request.raw() ?? ''
      const signature = request.header('stripe-signature')
      await this.topUps.handleWebhook(rawBody, signature)
      await this.subscriptions.handleWebhook(rawBody, signature)
    } catch (error) {
      // Signature invalide ou paiement non configuré : notification rejetée.
      logger.warn({ err: error }, 'stripe webhook rejected')
      return response.badRequest({ received: false })
    }
    return response.ok({ received: true })
  }
}
