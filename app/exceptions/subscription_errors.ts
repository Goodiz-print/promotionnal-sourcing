import { Exception } from '@adonisjs/core/exceptions'

/** Souscription en ligne demandée alors que Stripe Billing n'est pas configuré. */
export class SubscriptionBillingUnavailableException extends Exception {
  static status = 503
  static code = 'E_SUBSCRIPTION_BILLING_UNAVAILABLE'
  static message = 'Online subscription is not available'
}

/**
 * L'organisation a déjà un abonnement en cours : on n'en ouvre pas un second
 * (le changement de formule passe par le portail de facturation). Interceptée
 * par le controller (flash + redirection).
 */
export class SubscriptionAlreadyActiveException extends Exception {
  static status = 409
  static code = 'E_SUBSCRIPTION_ALREADY_ACTIVE'
  static message = 'This organization already has a current subscription'
}

/** Portail de facturation demandé sans client Stripe (jamais souscrit en ligne). */
export class BillingPortalUnavailableException extends Exception {
  static status = 409
  static code = 'E_BILLING_PORTAL_UNAVAILABLE'
  static message = 'No billing account for this organization'
}

/**
 * Un premier paiement d'abonnement est encore en validation (3-D Secure,
 * prélèvement) : il peut aboutir, on n'ouvre pas de seconde souscription.
 * Interceptée par le controller (flash + redirection).
 */
export class SubscriptionPaymentPendingException extends Exception {
  static status = 409
  static code = 'E_SUBSCRIPTION_PAYMENT_PENDING'
  static message = 'A subscription payment is still being confirmed'
}

/**
 * Doublon d'abonnements en ligne toujours en conflit après arbitrage : la
 * notification est rejetée (Stripe la renverra) plutôt qu'appliquée à moitié.
 */
export class SubscriptionSyncConflictException extends Exception {
  static status = 409
  static code = 'E_SUBSCRIPTION_SYNC_CONFLICT'
  static message = 'Conflicting online subscriptions for this organization'
}
