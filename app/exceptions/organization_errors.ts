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

/**
 * L'email invité appartient déjà à un membre de l'organisation.
 */
export class AlreadyMemberException extends Exception {
  static status = 422
  static code = 'E_ALREADY_MEMBER'
  static message = 'This email already belongs to a member of the organization'
}

/**
 * Invitation introuvable (id inexistant).
 */
export class OrganizationInvitationNotFoundException extends Exception {
  static status = 404
  static code = 'E_ORGANIZATION_INVITATION_NOT_FOUND'
  static message = 'Organization invitation not found'
}

/**
 * L'invitation visée n'est plus en attente (déjà acceptée ou révoquée) — elle
 * ne peut donc pas être renvoyée. Toujours interceptée dans le controller
 * (flash + redirection), jamais rendue directement au client.
 */
export class InvitationNotPendingException extends Exception {
  static status = 422
  static code = 'E_INVITATION_NOT_PENDING'
  static message = 'This invitation is no longer pending'
}

/**
 * L'utilisateur n'a pas d'organisation courante utilisable (aucune, ou une
 * organisation archivée). Les routes protégées par le middleware `onboarded`
 * n'atteignent normalement jamais ce cas — il couvre les accès directs et les
 * courses entre deux requêtes.
 */
export class NoCurrentOrganizationException extends Exception {
  static status = 403
  static code = 'E_NO_CURRENT_ORG'
  static message = 'No current organization'
}

/**
 * L'utilisateur n'est pas membre de l'organisation visée (bascule ou départ
 * sur une organisation qui n'est pas la sienne).
 */
export class NotAMemberException extends Exception {
  static status = 403
  static code = 'E_NOT_A_MEMBER'
  static message = 'You are not a member of this organization'
}

/**
 * L'organisation visée est archivée : on ne peut ni y basculer, ni l'archiver
 * une seconde fois.
 */
export class OrganizationArchivedException extends Exception {
  static status = 422
  static code = 'E_ORGANIZATION_ARCHIVED'
  static message = 'This organization is archived'
}
