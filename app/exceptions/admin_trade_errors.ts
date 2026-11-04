import { Exception } from '@adonisjs/core/exceptions'

/** Demande de devis, devis ou commande introuvable côté supervision plateforme. */
export class AdminTradeNotFoundException extends Exception {
  static status = 404
  static code = 'E_ADMIN_TRADE_NOT_FOUND'
  static message = 'Trade record not found'
}

/** Relance impossible : demande qui n'attend plus de réponse, ou aucun destinataire relançable. */
export class AdminRfqNotRemindableException extends Exception {
  static status = 409
  static code = 'E_ADMIN_RFQ_NOT_REMINDABLE'
  static message = 'Nobody can be reminded on this rfq'
}

/** Fil, message ou signalement introuvable côté modération de la messagerie (#167). */
export class AdminMessagingNotFoundException extends Exception {
  static status = 404
  static code = 'E_ADMIN_MESSAGING_NOT_FOUND'
  static message = 'Conversation, message or report not found'
}

/** Action sans objet : message déjà (dé)masqué, fil déjà (dé)bloqué, signalement déjà traité. */
export class AdminMessagingStateException extends Exception {
  static status = 409
  static code = 'E_ADMIN_MESSAGING_STATE'
  static message = 'This action is not applicable in the current state'
}
