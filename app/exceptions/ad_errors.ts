import { Exception } from '@adonisjs/core/exceptions'
import { errors } from '@vinejs/vine'

/** Campagne introuvable, ou appartenant à une autre organisation. */
export class AdCampaignNotFoundException extends Exception {
  static status = 404
  static code = 'E_AD_CAMPAIGN_NOT_FOUND'
  static message = 'Ad campaign not found'
}

/**
 * Le produit ne peut pas être sponsorisé : il n'appartient pas à
 * l'organisation, ou il a déjà une campagne. Interceptée par le controller
 * (flash + redirection).
 */
export class AdProductNotEligibleException extends Exception {
  static status = 422
  static code = 'E_AD_PRODUCT_NOT_ELIGIBLE'
  static message = 'This product cannot be sponsored'
}

/**
 * Campagne suspendue par l'équipe plateforme : le fournisseur ne peut ni la
 * réactiver ni la mettre en pause. Interceptée par le controller.
 */
export class AdCampaignSuspendedException extends Exception {
  static status = 422
  static code = 'E_AD_CAMPAIGN_SUSPENDED'
  static message = 'This campaign has been suspended by the platform'
}

/** Débit supérieur au solde du portefeuille publicitaire. */
export class InsufficientAdFundsException extends Exception {
  static status = 422
  static code = 'E_AD_INSUFFICIENT_FUNDS'
  static message = 'Insufficient ad wallet balance'
}

/** Recharge en ligne demandée alors que le paiement n'est pas configuré. */
export class AdPaymentUnavailableException extends Exception {
  static status = 503
  static code = 'E_AD_PAYMENT_UNAVAILABLE'
  static message = 'Online payment is not available'
}

/**
 * Champs d'une campagne incohérents entre eux : budget du jour inférieur à
 * l'enchère (`budgetBelowBid`), ou fin avant le début (`endBeforeStart`).
 * Convertie par le controller en erreur de validation du champ, traduite.
 */
export class AdCampaignIncoherentException extends Exception {
  static status = 422
  static code = 'E_AD_CAMPAIGN_INCOHERENT'

  constructor(
    public field: 'dailyBudget' | 'endsOn',
    public reason: 'budgetBelowBid' | 'endBeforeStart'
  ) {
    super(`Incoherent ad campaign: ${reason}`)
  }
}

/** Erreur de validation (422) rattachée à un champ du formulaire de campagne. */
export function adCampaignFieldError(field: string, message: string, rule: string) {
  return new errors.E_VALIDATION_ERROR([{ field, message, rule }])
}
