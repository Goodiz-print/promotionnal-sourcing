import logger from '@adonisjs/core/services/logger'
import SubscriptionBillingGateway from '#services/subscriptions/subscription_billing_gateway'
import { SubscriptionBillingUnavailableException } from '#exceptions/subscription_errors'
import { isSubscriptionEventType } from '#shared/helpers/subscription'
import type { BillingSubscriptionSnapshot } from '#shared/types/subscription'

/** Prestataire inerte : pas de souscription en ligne (Stripe Billing non configuré). */
export default class NullSubscriptionBillingGateway extends SubscriptionBillingGateway {
  readonly enabled = false

  async createCustomer(): Promise<string> {
    throw new SubscriptionBillingUnavailableException()
  }

  async createCheckout(): Promise<string> {
    throw new SubscriptionBillingUnavailableException()
  }

  async createPortalSession(): Promise<string> {
    throw new SubscriptionBillingUnavailableException()
  }

  /**
   * Ignore toute notification (le webhook reste partagé avec les recharges
   * publicitaires). Une notification d'abonnement reçue ici signale une
   * configuration retirée alors que des abonnements tournent encore chez
   * Stripe : la formule ne suivrait plus, on le signale. Le corps n'est lu que
   * pour ce signalement — sans signature vérifiée, rien n'en est appliqué.
   */
  async parseWebhook(rawBody: string): Promise<null> {
    const type = eventTypeOf(rawBody)
    if (type && isSubscriptionEventType(type)) {
      logger.warn(
        { type },
        'subscription webhook ignored: online subscription is not configured (STRIPE_PRICE_*)'
      )
    }
    return null
  }

  async fetchSubscription(): Promise<BillingSubscriptionSnapshot> {
    throw new SubscriptionBillingUnavailableException()
  }

  async cancelSubscription(): Promise<BillingSubscriptionSnapshot> {
    throw new SubscriptionBillingUnavailableException()
  }
}

/** Type d'une notification JSON, sans lever si le corps n'en est pas une. */
function eventTypeOf(rawBody: string): string | null {
  try {
    const body: unknown = JSON.parse(rawBody)
    if (body && typeof body === 'object' && 'type' in body && typeof body.type === 'string') {
      return body.type
    }
  } catch {
    // Corps illisible : rien à signaler.
  }
  return null
}
