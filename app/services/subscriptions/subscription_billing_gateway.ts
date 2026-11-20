import type {
  BillingCustomerRequest,
  BillingSubscriptionSnapshot,
  BillingWebhookEvent,
  SubscriptionCheckoutRequest,
} from '#shared/types/subscription'

/**
 * Prestataire de facturation des abonnements. Classe abstraite = jeton
 * d'injection ; l'implémentation est liée dans `providers/subscription_provider.ts`
 * (Stripe Billing, ou inerte sans configuration).
 */
export default abstract class SubscriptionBillingGateway {
  /** `false` pour le prestataire inerte (Stripe non configuré). */
  abstract readonly enabled: boolean

  /** Crée le client chez le prestataire et renvoie son identifiant. */
  abstract createCustomer(request: BillingCustomerRequest): Promise<string>

  /**
   * Ouvre une page de souscription récurrente hébergée et renvoie son URL : la
   * carte est saisie chez le prestataire, jamais sur la plateforme.
   */
  abstract createCheckout(request: SubscriptionCheckoutRequest): Promise<string>

  /**
   * Ouvre le portail de facturation du client (changement de formule,
   * résiliation, moyen de paiement, factures) et renvoie son URL.
   */
  abstract createPortalSession(customerId: string, returnUrl: string): Promise<string>

  /**
   * Lit une notification du prestataire. Renvoie l'événement s'il concerne un
   * abonnement (`customer.subscription.*`, `invoice.*`), `null` sinon. Lève si
   * la signature est invalide.
   */
  abstract parseWebhook(
    rawBody: string,
    signature: string | undefined
  ): Promise<BillingWebhookEvent | null>

  /** État **actuel** d'un abonnement chez le prestataire. */
  abstract fetchSubscription(subscriptionId: string): Promise<BillingSubscriptionSnapshot>

  /**
   * Résilie immédiatement un abonnement chez le prestataire (doublon) et renvoie
   * son nouvel état. Ne rembourse pas : le remboursement reste une décision de
   * l'équipe plateforme.
   */
  abstract cancelSubscription(subscriptionId: string): Promise<BillingSubscriptionSnapshot>
}
