import Stripe from 'stripe'
import adsConfig from '#config/ads'
import AdPaymentGateway from '#services/ads/ad_payment_gateway'
import { AdPaymentUnavailableException } from '#exceptions/ad_errors'
import { AD_CURRENCY, type AdCheckoutRequest, type AdPaymentConfirmation } from '#shared/types/ads'

/** Clé de métadonnée qui distingue une recharge de tout autre paiement du compte Stripe. */
const KIND = 'ad_wallet_top_up'

/**
 * Recharges par **Stripe Checkout** : la carte est saisie sur la page hébergée
 * par Stripe, la plateforme ne voit ni ne stocke aucune donnée de paiement.
 * Le portefeuille n'est crédité qu'à réception du webhook signé
 * `checkout.session.completed` — jamais au retour du navigateur.
 */
export default class StripeAdPaymentGateway extends AdPaymentGateway {
  readonly enabled = true

  #client?: Stripe

  private get client(): Stripe {
    const key = adsConfig.payment.stripeSecretKey
    if (!key) throw new AdPaymentUnavailableException()
    this.#client ??= new Stripe(key)
    return this.#client
  }

  async createCheckout(request: AdCheckoutRequest): Promise<string> {
    const session = await this.client.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: AD_CURRENCY.toLowerCase(),
            unit_amount: request.amountCents,
            product_data: { name: request.label },
          },
        },
      ],
      ...(request.customerEmail ? { customer_email: request.customerEmail } : {}),
      client_reference_id: String(request.organizationId),
      metadata: { kind: KIND, organizationId: String(request.organizationId) },
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
    })

    if (!session.url) throw new AdPaymentUnavailableException()
    return session.url
  }

  async confirmFromWebhook(
    rawBody: string,
    signature: string | undefined
  ): Promise<AdPaymentConfirmation | null> {
    const secret = adsConfig.payment.stripeWebhookSecret
    if (!secret || !signature) throw new AdPaymentUnavailableException()

    // Lève si la signature ne correspond pas : la notification est rejetée.
    const event = this.client.webhooks.constructEvent(rawBody, signature, secret)
    if (event.type !== 'checkout.session.completed') return null

    const session = event.data.object
    const organizationId = Number(session.metadata?.organizationId)
    if (session.metadata?.kind !== KIND || session.payment_status !== 'paid') return null
    if (!Number.isInteger(organizationId) || !session.amount_total) return null

    return { reference: `stripe:${session.id}`, organizationId, amountCents: session.amount_total }
  }
}
