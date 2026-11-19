import Stripe from 'stripe'
import subscriptionsConfig from '#config/subscriptions'
import SubscriptionBillingGateway from '#services/subscriptions/subscription_billing_gateway'
import { SubscriptionBillingUnavailableException } from '#exceptions/subscription_errors'
import {
  PAID_SUBSCRIPTION_PLANS,
  type BillingCustomerRequest,
  type BillingSubscriptionSnapshot,
  type BillingWebhookEvent,
  type PaidSubscriptionPlan,
  type SubscriptionCheckoutRequest,
} from '#shared/types/subscription'

/** Métadonnée qui distingue un abonnement fournisseur de tout autre objet du compte Stripe. */
const KIND = 'supplier_subscription'

/**
 * Abonnements par **Stripe Billing** : page de souscription hébergée (Checkout
 * en mode `subscription`) et portail de facturation. La plateforme ne voit ni
 * ne stocke aucune donnée de carte ; elle ne conserve que l'identifiant client
 * (`billing_profiles.stripe_customer_id`) et celui de l'abonnement.
 */
export default class StripeSubscriptionBillingGateway extends SubscriptionBillingGateway {
  readonly enabled = true

  #client?: Stripe

  private get client(): Stripe {
    const key = subscriptionsConfig.billing.stripeSecretKey
    if (!key) throw new SubscriptionBillingUnavailableException()
    this.#client ??= new Stripe(key)
    return this.#client
  }

  async createCustomer(request: BillingCustomerRequest): Promise<string> {
    const customer = await this.client.customers.create({
      name: request.name,
      ...(request.email ? { email: request.email } : {}),
      metadata: { kind: KIND, organizationId: String(request.organizationId) },
    })
    return customer.id
  }

  async createCheckout(request: SubscriptionCheckoutRequest): Promise<string> {
    const price = subscriptionsConfig.billing.prices[request.plan]
    if (!price) throw new SubscriptionBillingUnavailableException()

    const metadata = { kind: KIND, organizationId: String(request.organizationId) }
    const session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      customer: request.customerId,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: String(request.organizationId),
      metadata,
      // Portées par l'abonnement lui-même : relues à chaque notification.
      subscription_data: { metadata },
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
    })

    if (!session.url) throw new SubscriptionBillingUnavailableException()
    return session.url
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return session.url
  }

  async parseWebhook(
    rawBody: string,
    signature: string | undefined
  ): Promise<BillingWebhookEvent | null> {
    const secret = subscriptionsConfig.billing.stripeWebhookSecret
    if (!secret || !signature) throw new SubscriptionBillingUnavailableException()

    // Lève si la signature ne correspond pas : la notification est rejetée.
    const event = this.client.webhooks.constructEvent(rawBody, signature, secret)
    const subscriptionId = subscriptionIdOf(event)
    return subscriptionId ? { id: event.id, type: event.type, subscriptionId } : null
  }

  async fetchSubscription(subscriptionId: string): Promise<BillingSubscriptionSnapshot> {
    const subscription = await this.client.subscriptions.retrieve(subscriptionId)
    const item = subscription.items.data[0]
    const organizationId = Number(subscription.metadata?.organizationId)

    return {
      id: subscription.id,
      customerId:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      providerStatus: subscription.status,
      plan: planOfPrice(item?.price.id),
      organizationId: Number.isInteger(organizationId) ? organizationId : null,
      currentPeriodStart: fromUnix(item?.current_period_start ?? subscription.start_date),
      currentPeriodEnd: item ? fromUnix(item.current_period_end) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? fromUnix(subscription.canceled_at) : null,
    }
  }
}

/** Abonnement concerné par une notification `customer.subscription.*` ou `invoice.*`. */
function subscriptionIdOf(event: Stripe.Event): string | null {
  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object as Stripe.Subscription
    return subscription.id
  }
  if (event.type.startsWith('invoice.')) {
    const invoice = event.data.object as Stripe.Invoice
    const ref = invoice.parent?.subscription_details?.subscription
    if (!ref) return null
    return typeof ref === 'string' ? ref : ref.id
  }
  return null
}

/** Formule correspondant à un prix Stripe configuré. */
function planOfPrice(priceId: string | undefined): PaidSubscriptionPlan | null {
  if (!priceId) return null
  const { prices } = subscriptionsConfig.billing
  return PAID_SUBSCRIPTION_PLANS.find((plan) => prices[plan] === priceId) ?? null
}

function fromUnix(seconds: number): Date {
  return new Date(seconds * 1000)
}
