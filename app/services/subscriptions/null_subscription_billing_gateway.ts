import SubscriptionBillingGateway from '#services/subscriptions/subscription_billing_gateway'
import { SubscriptionBillingUnavailableException } from '#exceptions/subscription_errors'
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

  async parseWebhook(): Promise<null> {
    return null
  }

  async fetchSubscription(): Promise<BillingSubscriptionSnapshot> {
    throw new SubscriptionBillingUnavailableException()
  }
}
