import { Exception } from '@adonisjs/core/exceptions'

/**
 * Aucun compte ne correspond à l'email donné (commandes `admin:grant` /
 * `admin:revoke`).
 */
export class PlatformUserNotFoundException extends Exception {
  static status = 404
  static code = 'E_PLATFORM_USER_NOT_FOUND'
  static message = 'No user found for this email'
}

/**
 * Organisation introuvable dans le back-office (`/admin/organizations/:id`).
 */
export class AdminOrganizationNotFoundException extends Exception {
  static status = 404
  static code = 'E_ADMIN_ORGANIZATION_NOT_FOUND'
  static message = 'Organization not found'
}

/**
 * Un admin tente de modifier son propre rôle plateforme (écran Utilisateurs).
 */
export class CannotChangeOwnPlatformRoleException extends Exception {
  static status = 403
  static code = 'E_CANNOT_CHANGE_OWN_PLATFORM_ROLE'
  static message = 'You cannot change your own platform role'
}

/**
 * Compte introuvable dans le back-office (`/admin/users/:id/...`).
 */
export class AdminUserNotFoundException extends Exception {
  static status = 404
  static code = 'E_ADMIN_USER_NOT_FOUND'
  static message = 'User not found'
}

/**
 * Import introuvable dans le back-office (`/admin/imports/:id`).
 */
export class AdminImportNotFoundException extends Exception {
  static status = 404
  static code = 'E_ADMIN_IMPORT_NOT_FOUND'
  static message = 'Import not found'
}

/**
 * Traduction introuvable (entité, identifiant ou langue inconnus, ou ligne
 * source) dans l'écran de relecture des traductions automatiques.
 */
export class AdminTranslationNotFoundException extends Exception {
  static status = 404
  static code = 'E_ADMIN_TRANSLATION_NOT_FOUND'
  static message = 'Translation not found'
}
