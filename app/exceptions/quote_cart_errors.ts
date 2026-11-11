import { Exception } from '@adonisjs/core/exceptions'

/**
 * Ligne introuvable, ou appartenant au panier d'un autre utilisateur ou d'une
 * autre organisation — indistinguables volontairement (404, comme les RFQ).
 */
export class QuoteCartItemNotFoundException extends Exception {
  static status = 404
  static code = 'E_QUOTE_CART_ITEM_NOT_FOUND'
  static message = 'Quote cart item not found'
}

/**
 * Validation refusée : aucune ligne du panier n'a de fournisseur joignable
 * (panier vide, ou seulement des produits de fournisseurs sans compte).
 */
export class QuoteCartEmptyException extends Exception {
  static status = 422
  static code = 'E_QUOTE_CART_EMPTY'
  static message = 'The quote cart has nothing to request'
}
