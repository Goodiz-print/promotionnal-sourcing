import app from '@adonisjs/core/services/app'
import SubscriptionBillingGateway from '#services/subscriptions/subscription_billing_gateway'
import type {
  BillingCustomerRequest,
  BillingSubscriptionSnapshot,
  BillingWebhookEvent,
  SubscriptionCheckoutRequest,
} from '#shared/types/subscription'

/**
 * Prestataire de facturation factice : enregistre les clients, pages de
 * souscription et portails demandés, et renvoie la notification et l'état
 * d'abonnement qu'on lui a dit de renvoyer. Sert à vérifier la souscription
 * en ligne sans Stripe.
 */
export default class FakeSubscriptionBillingGateway extends SubscriptionBillingGateway {
  enabled = true
  checkoutUrl = 'https://billing.test/checkout'
  portalUrl = 'https://billing.test/portal'
  customers: BillingCustomerRequest[] = []
  checkouts: SubscriptionCheckoutRequest[] = []
  portals: { customerId: string; returnUrl: string }[] = []
  /** Réponse de `parseWebhook` ; `Error` pour une signature invalide. */
  event: BillingWebhookEvent | null | Error = null
  /** État renvoyé par `fetchSubscription`, par identifiant d'abonnement. */
  subscriptions = new Map<string, BillingSubscriptionSnapshot>()
  fetches = 0
  /** Abonnements résiliés chez le prestataire (doublons). */
  cancellations: string[] = []

  async createCustomer(request: BillingCustomerRequest): Promise<string> {
    this.customers.push(request)
    return `cus_test_${this.customers.length}`
  }

  async createCheckout(request: SubscriptionCheckoutRequest): Promise<string> {
    this.checkouts.push(request)
    return this.checkoutUrl
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    this.portals.push({ customerId, returnUrl })
    return this.portalUrl
  }

  async parseWebhook(): Promise<BillingWebhookEvent | null> {
    if (this.event instanceof Error) throw this.event
    return this.event
  }

  async fetchSubscription(subscriptionId: string): Promise<BillingSubscriptionSnapshot> {
    this.fetches++
    const snapshot = this.subscriptions.get(subscriptionId)
    if (!snapshot) throw new Error(`unknown subscription ${subscriptionId}`)
    return snapshot
  }

  async cancelSubscription(subscriptionId: string): Promise<BillingSubscriptionSnapshot> {
    const snapshot = await this.fetchSubscription(subscriptionId)
    this.cancellations.push(subscriptionId)
    const cancelled = {
      ...snapshot,
      providerStatus: 'canceled',
      canceledAt: new Date(),
      cancelAtPeriodEnd: false,
    }
    this.subscriptions.set(subscriptionId, cancelled)
    return cancelled
  }
}

/** Installe le prestataire factice ; `restore` est à appeler en fin de test. */
export function installFakeSubscriptionBillingGateway(): {
  gateway: FakeSubscriptionBillingGateway
  restore(): void
} {
  const gateway = new FakeSubscriptionBillingGateway()
  app.container.swap(SubscriptionBillingGateway, () => gateway)
  return { gateway, restore: () => app.container.restore(SubscriptionBillingGateway) }
}
