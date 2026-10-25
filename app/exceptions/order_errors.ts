import { Exception } from '@adonisjs/core/exceptions'

/**
 * Commande introuvable, ou appartenant à une autre organisation que celle de
 * l'appelant — indistinguables volontairement, comme pour les devis.
 */
export class OrderNotFoundException extends Exception {
  static status = 404
  static code = 'E_ORDER_NOT_FOUND'
  static message = 'Order not found'
}

/** Seul un devis accepté donne lieu à une commande. */
export class OrderNotCreatableException extends Exception {
  static status = 422
  static code = 'E_ORDER_NOT_CREATABLE'
  static message = 'Only an accepted quote can become an order'
}

/**
 * Transition refusée : la commande n'est pas dans un statut d'où l'action
 * part (déjà traitée, annulée…), ou l'action n'est pas ouverte à ce côté.
 */
export class OrderTransitionException extends Exception {
  static status = 422
  static code = 'E_ORDER_TRANSITION'
  static message = 'This action is not possible in the current order status'
}
