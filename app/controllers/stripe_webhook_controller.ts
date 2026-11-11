import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import AdTopUpService from '#services/ad_top_up_service'

/**
 * Notifications de paiement de Stripe (recharges de portefeuille publicitaire,
 * cf. `docs/ads.md`). Vraie route d'API : hors locale, hors session, exemptée
 * de CSRF — l'appelant est authentifié par la **signature** de la notification,
 * vérifiée sur le corps brut. Répond en JSON, comme Stripe l'attend.
 */
@inject()
export default class StripeWebhookController {
  constructor(private topUps: AdTopUpService) {}

  async store({ request, response }: HttpContext) {
    try {
      await this.topUps.handleWebhook(request.raw() ?? '', request.header('stripe-signature'))
    } catch (error) {
      // Signature invalide ou paiement non configuré : notification rejetée.
      logger.warn({ err: error }, 'stripe webhook rejected')
      return response.badRequest({ received: false })
    }
    return response.ok({ received: true })
  }
}
