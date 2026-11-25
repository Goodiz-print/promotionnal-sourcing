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

/**
 * Saisie admin d'un abonnement alors qu'un autre est en cours, programmé ou en
 * attente de paiement : un seul à la fois (le prolonger ou le résilier d'abord).
 */
export class SubscriptionAlreadyOpenException extends Exception {
  static status = 409
  static code = 'E_SUBSCRIPTION_ALREADY_OPEN'
  static message = 'This organization already has an open subscription'
}

/** Dates d'abonnement incohérentes : fin avant le début, ou fin déjà passée. */
export class InvalidSubscriptionPeriodException extends Exception {
  static status = 422
  static code = 'E_INVALID_SUBSCRIPTION_PERIOD'
  static message = 'Invalid subscription period'
}

/**
 * Action admin réservée aux abonnements manuels encore ouverts : un abonnement
 * en ligne se gère dans Stripe, un abonnement terminé ne se modifie plus.
 */
export class SubscriptionNotEditableException extends Exception {
  static status = 409
  static code = 'E_SUBSCRIPTION_NOT_EDITABLE'
  static message = 'This subscription cannot be changed here'
}

/** Abonnement manuel demandé pour une organisation qui ne vend pas (type `buyer`). */
export class SubscriptionNotSupplierException extends Exception {
  static status = 422
  static code = 'E_SUBSCRIPTION_NOT_SUPPLIER'
  static message = 'Only supplier organizations can subscribe'
}
