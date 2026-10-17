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
