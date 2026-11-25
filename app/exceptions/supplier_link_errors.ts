import { Exception } from '@adonisjs/core/exceptions'

/** Fiche fournisseur introuvable. */
export class SupplierLinkNotFoundException extends Exception {
  static status = 404
  static code = 'E_SUPPLIER_LINK_NOT_FOUND'
  static message = 'Supplier not found'
}

/** La fiche est déjà rattachée : la détacher d'abord (une seule organisation par fiche). */
export class SupplierAlreadyLinkedException extends Exception {
  static status = 409
  static code = 'E_SUPPLIER_ALREADY_LINKED'
  static message = 'Supplier is already linked to an organization'
}

/** Détachement d'une fiche qui n'est rattachée à aucune organisation. */
export class SupplierNotLinkedException extends Exception {
  static status = 409
  static code = 'E_SUPPLIER_NOT_LINKED'
  static message = 'Supplier is not linked to an organization'
}

/** L'organisation cible n'existe pas, n'est pas un fournisseur ou est archivée. */
export class SupplierLinkOrganizationInvalidException extends Exception {
  static status = 422
  static code = 'E_SUPPLIER_LINK_ORGANIZATION_INVALID'
  static message = 'Target organization must be an active supplier organization'
}
