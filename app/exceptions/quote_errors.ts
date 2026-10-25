import { Exception } from '@adonisjs/core/exceptions'

/**
 * Devis introuvable, ou appartenant à une autre organisation que celle de
 * l'appelant — indistinguables volontairement, comme pour les demandes.
 */
export class QuoteNotFoundException extends Exception {
  static status = 404
  static code = 'E_QUOTE_NOT_FOUND'
  static message = 'Quote not found'
}

/**
 * Le fournisseur ne peut pas chiffrer cette demande : elle n'est plus ouverte
 * (close, échue, échéance passée) ou il l'a déclinée.
 */
export class QuoteNotAllowedException extends Exception {
  static status = 422
  static code = 'E_QUOTE_NOT_ALLOWED'
  static message = 'This request for quotation no longer accepts quotes'
}

/**
 * Le fournisseur a déjà un devis vivant (brouillon, remis ou accepté) pour cette
 * demande : il le modifie, il n'en ouvre pas un second.
 */
export class QuoteAlreadyExistsException extends Exception {
  static status = 422
  static code = 'E_QUOTE_ALREADY_EXISTS'
  static message = 'A quote already exists for this request for quotation'
}

/** Modification d'un devis qui n'est plus un brouillon : il est figé. */
export class QuoteNotEditableException extends Exception {
  static status = 422
  static code = 'E_QUOTE_NOT_EDITABLE'
  static message = 'Only a draft quote can be edited'
}

/**
 * Remise refusée : le devis n'est plus un brouillon, ne contient aucune ligne,
 * ou sa date de validité est passée.
 */
export class QuoteNotSubmittableException extends Exception {
  static status = 422
  static code = 'E_QUOTE_NOT_SUBMITTABLE'
  static message = 'This quote cannot be submitted'
}

/**
 * Décision refusée : le devis n'est pas remis, ou la demande n'est plus
 * ouverte (close, échue) — une décision tardive ne rouvre rien.
 */
export class QuoteNotDecidableException extends Exception {
  static status = 422
  static code = 'E_QUOTE_NOT_DECIDABLE'
  static message = 'This quote cannot be accepted or rejected'
}

/**
 * Lignes incohérentes : un item qui n'appartient pas à la demande, répété, ou
 * un devis sans aucune ligne.
 */
export class QuoteInvalidItemsException extends Exception {
  static status = 422
  static code = 'E_QUOTE_INVALID_ITEMS'
  static message = 'The quote lines do not match the request for quotation'
}

/** Date de validité antérieure à aujourd'hui. */
export class QuoteInvalidValidityException extends Exception {
  static status = 422
  static code = 'E_QUOTE_INVALID_VALIDITY'
  static message = 'The validity date cannot be in the past'
}
