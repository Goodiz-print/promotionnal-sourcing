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
