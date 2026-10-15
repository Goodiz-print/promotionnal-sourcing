import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le mot de passe actuel saisi ne correspond pas : exigé pour changer de mot de
 * passe et pour supprimer le compte. Toujours interceptée dans le controller
 * (erreur de champ + redirection), jamais rendue directement au client.
 */
export class InvalidCurrentPasswordException extends Exception {
  static status = 422
  static code = 'E_INVALID_CURRENT_PASSWORD'
  static message = 'The current password is incorrect'
}

/**
 * L'utilisateur est le dernier `owner` d'au moins une organisation non
 * archivée : supprimer son compte la laisserait sans propriétaire. Porte les
 * noms des organisations concernées pour l'afficher à l'utilisateur.
 */
export class AccountOwnsOrganizationsException extends Exception {
  static status = 422
  static code = 'E_ACCOUNT_OWNS_ORGANIZATIONS'
  static message = 'The account is the last owner of one or more active organizations'

  constructor(public organizationNames: string[]) {
    super()
  }
}
