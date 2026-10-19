import { Exception } from '@adonisjs/core/exceptions'

/**
 * Cible ou décision hors des listes déclarées dans `shared/types/moderation.ts`.
 */
export class InvalidModerationInputException extends Exception {
  static status = 422
  static code = 'E_MODERATION_INPUT_INVALID'
  static message = 'Invalid moderation target or decision'
}
