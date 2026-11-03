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
