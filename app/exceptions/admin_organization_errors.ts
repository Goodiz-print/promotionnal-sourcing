import { Exception } from '@adonisjs/core/exceptions'

/**
 * Tentative d'archivage d'une organisation deja archivee.
 */
export class OrganizationAlreadyArchivedException extends Exception {
  static status = 409
  static code = 'E_ORGANIZATION_ALREADY_ARCHIVED'
  static message = 'This organization is already archived'
}

/**
 * Tentative de restauration d'une organisation qui n'est pas archivee.
 */
export class OrganizationNotArchivedException extends Exception {
  static status = 409
  static code = 'E_ORGANIZATION_NOT_ARCHIVED'
  static message = 'This organization is not archived'
}

/**
 * Tentative de changement de type vers un type sans capacite fournisseur alors
 * que l'organisation a des produits ou un profil fournisseur actif.
 */
export class OrganizationHasSupplierDataException extends Exception {
  static status = 409
  static code = 'E_ORGANIZATION_HAS_SUPPLIER_DATA'
  static message = 'Cannot change type: organization has products or active supplier profile'

  constructor(
    public hasProducts: boolean,
    public hasSupplierProfile: boolean
  ) {
    super()
  }
}

/**
 * Membre introuvable dans l'organisation (id inexistant ou appartenant a une
 * autre organisation).
 */
export class AdminOrganizationMemberNotFoundException extends Exception {
  static status = 404
  static code = 'E_ADMIN_ORGANIZATION_MEMBER_NOT_FOUND'
  static message = 'Organization member not found'
}

/**
 * Invitation introuvable dans l'organisation (id inexistant ou appartenant a
 * une autre organisation).
 */
export class AdminOrganizationInvitationNotFoundException extends Exception {
  static status = 404
  static code = 'E_ADMIN_ORGANIZATION_INVITATION_NOT_FOUND'
  static message = 'Organization invitation not found'
}
