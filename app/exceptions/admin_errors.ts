import { Exception } from '@adonisjs/core/exceptions'
import { errors as vineErrors } from '@vinejs/vine'

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
 * Période d'analyse refusée (écran « Ce que cherchent les clients », #173) :
 * erreur de validation sur le champ concerné, rendue comme les autres (422).
 */
export function invalidSearchInsightsPeriod(field: 'from' | 'to', rule: 'order' | 'maxDays') {
  return new vineErrors.E_VALIDATION_ERROR([
    {
      field,
      message:
        rule === 'order'
          ? 'The start date must not be after the end date'
          : 'The period is too long',
      rule,
    },
  ])
}
