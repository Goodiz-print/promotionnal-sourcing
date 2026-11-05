import { Exception } from '@adonisjs/core/exceptions'

/**
 * L'auteur n'appartient à aucune des deux organisations du fil. Même message
 * qu'une conversation inexistante côté écran, pour ne rien révéler.
 */
export class ConversationAccessDeniedException extends Exception {
  static status = 403
  static code = 'E_CONVERSATION_ACCESS_DENIED'
  static message = 'You cannot access this conversation'
}

/**
 * Corps de message vide ou dépassant `MESSAGE_MAX_LENGTH`.
 */
export class InvalidMessageBodyException extends Exception {
  static status = 422
  static code = 'E_MESSAGE_BODY_INVALID'
  static message = 'Invalid message body'
}

/** Fil bloqué par la plateforme : plus aucun message ne peut y être posté. */
export class ConversationBlockedException extends Exception {
  static status = 409
  static code = 'E_CONVERSATION_BLOCKED'
  static message = 'This conversation has been blocked'
}

/** Un participant ne peut pas signaler son propre message. */
export class OwnMessageReportException extends Exception {
  static status = 422
  static code = 'E_OWN_MESSAGE_REPORT'
  static message = 'You cannot report your own message'
}

/** Message introuvable (ou fil auquel l'utilisateur n'a pas accès : même réponse). */
export class MessageNotFoundException extends Exception {
  static status = 404
  static code = 'E_MESSAGE_NOT_FOUND'
  static message = 'Message not found'
}
