import { Exception } from '@adonisjs/core/exceptions'

/**
 * Un admin tente de se suspendre ou se supprimer lui-même.
 */
export class CannotActOnSelfException extends Exception {
  static status = 403
  static code = 'E_CANNOT_ACT_ON_SELF'
  static message = 'You cannot perform this action on your own account'
}

/**
 * Un admin tente de suspendre ou supprimer un autre admin plateforme.
 */
export class CannotActOnPlatformAdminException extends Exception {
  static status = 403
  static code = 'E_CANNOT_ACT_ON_PLATFORM_ADMIN'
  static message = 'You cannot perform this action on a platform administrator'
}

/**
 * Tentative de suspension d'un compte déjà suspendu.
 */
export class UserAlreadySuspendedException extends Exception {
  static status = 409
  static code = 'E_USER_ALREADY_SUSPENDED'
  static message = 'This account is already suspended'
}

/**
 * Tentative de réactivation d'un compte non suspendu.
 */
export class UserNotSuspendedException extends Exception {
  static status = 409
  static code = 'E_USER_NOT_SUSPENDED'
  static message = 'This account is not suspended'
}

/**
 * Tentative de renvoi de vérification pour un compte déjà vérifié.
 */
export class UserAlreadyVerifiedException extends Exception {
  static status = 409
  static code = 'E_USER_ALREADY_VERIFIED'
  static message = 'This account is already verified'
}

/**
 * Tentative de suppression d'un compte qui est dernier owner d'une organisation active.
 */
export class UserOwnsOrganizationsException extends Exception {
  static status = 409
  static code = 'E_USER_OWNS_ORGANIZATIONS'
  static message = 'This account is the last owner of one or more active organizations'

  constructor(public blockingOrganizations: string[]) {
    super()
  }
}

/**
 * Connexion refusée car le compte est suspendu.
 */
export class AccountSuspendedException extends Exception {
  static status = 403
  static code = 'E_ACCOUNT_SUSPENDED'
  static message = 'This account has been suspended'
}
