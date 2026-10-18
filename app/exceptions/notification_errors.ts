import { Exception } from '@adonisjs/core/exceptions'

/**
 * Notification introuvable pour cet utilisateur. Volontairement indistinct d'une
 * notification inexistante : un utilisateur ne doit pas sonder les notifications
 * des autres.
 */
export class NotificationNotFoundException extends Exception {
  static status = 404
  static code = 'E_NOTIFICATION_NOT_FOUND'
  static message = 'Notification not found'
}

/**
 * Type de notification absent de `NOTIFICATION_TYPES`. Garde à l'exécution :
 * le typage ne protège pas les appelants en JavaScript ou issus de données.
 */
export class UnknownNotificationTypeException extends Exception {
  static status = 422
  static code = 'E_NOTIFICATION_TYPE_UNKNOWN'
  static message = 'Unknown notification type'
}
