import { Exception } from '@adonisjs/core/exceptions'

/**
 * Le membre visé (rétrogradation ou retrait) est le dernier `owner` de
 * l'organisation — une organisation doit toujours garder au moins un owner.
 * Toujours interceptée dans le controller (flash + redirection), jamais
 * rendue directement au client.
 */
export class LastOwnerException extends Exception {
  static status = 422
  static code = 'E_LAST_OWNER'
  static message = 'Cannot remove or demote the last owner of the organization'
}

/**
 * Membre introuvable dans l'organisation courante (id inexistant ou
 * appartenant à une autre organisation).
 */
export class OrganizationMemberNotFoundException extends Exception {
  static status = 404
  static code = 'E_ORGANIZATION_MEMBER_NOT_FOUND'
  static message = 'Organization member not found'
}
