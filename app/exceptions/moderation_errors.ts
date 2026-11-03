import { Exception } from '@adonisjs/core/exceptions'

/**
 * Cible ou décision hors des listes déclarées dans `shared/types/moderation.ts`.
 */
export class InvalidModerationInputException extends Exception {
  static status = 422
  static code = 'E_MODERATION_INPUT_INVALID'
  static message = 'Invalid moderation target or decision'
}

/**
 * Élément à modérer introuvable, ou non modérable (organisation non fournisseur
 * ou archivée, produit inactif).
 */
export class ModerationTargetNotFoundException extends Exception {
  static status = 404
  static code = 'E_MODERATION_TARGET_NOT_FOUND'
  static message = 'Moderation target not found'
}
