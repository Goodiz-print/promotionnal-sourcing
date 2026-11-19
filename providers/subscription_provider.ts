import type { ApplicationService } from '@adonisjs/core/types'
import subscriptionsConfig from '#config/subscriptions'
import SubscriptionBillingGateway from '#services/subscriptions/subscription_billing_gateway'
import NullSubscriptionBillingGateway from '#services/subscriptions/null_subscription_billing_gateway'
import StripeSubscriptionBillingGateway from '#services/subscriptions/stripe_subscription_billing_gateway'

/**
 * Lie le prestataire de facturation des abonnements : Stripe Billing quand la
 * clé et les deux prix sont configurés, prestataire inerte sinon (dev, test, CI).
 */
export default class SubscriptionProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(SubscriptionBillingGateway, async (resolver) => {
      return resolver.make(
        subscriptionsConfig.billing.enabled
          ? StripeSubscriptionBillingGateway
          : NullSubscriptionBillingGateway
      )
    })
  }
}
