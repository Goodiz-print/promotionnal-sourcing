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
 * Validation refusée : aucune ligne du panier n'est demandable (panier vide, ou
 * seulement des produits dépubliés).
 */
export class QuoteCartEmptyException extends Exception {
  static status = 422
  static code = 'E_QUOTE_CART_EMPTY'
  static message = 'The quote cart has nothing to request'
}

/**
 * Option refusée sur une ligne : variante qui n'est pas une variante active du
 * produit, marquage d'un autre produit, nombre de couleurs au-delà du maximum
 * de la technique, ou couleurs sans marquage.
 */
export class QuoteCartInvalidOptionException extends Exception {
  static status = 422
  static code = 'E_QUOTE_CART_INVALID_OPTION'
  static message = 'This option is not available for the product'
}

/**
 * Le changement de variante ferait doublon avec une autre ligne du panier
 * (même produit, même variante) : on modifie plutôt cette ligne-là.
 */
export class QuoteCartDuplicateLineException extends Exception {
  static status = 409
  static code = 'E_QUOTE_CART_DUPLICATE_LINE'
  static message = 'This product variant is already in the quote cart'
}

/**
 * Validation refusée : entre la lecture du panier et son envoi, une fiche
 * fournisseur a été détachée de l'organisation destinataire (#231, #240). Rien
 * n'est créé ; recharger le panier montre son nouvel état.
 */
export class QuoteCartChangedException extends Exception {
  static status = 409
  static code = 'E_QUOTE_CART_CHANGED'
  static message = 'The quote cart changed during checkout'
}
