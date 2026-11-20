import { Exception } from '@adonisjs/core/exceptions'

/**
 * Contact commercial introuvable dans l'organisation courante (id inexistant
 * ou appartenant à un autre fournisseur).
 */
export class SupplierContactNotFoundException extends Exception {
  static status = 404
  static code = 'E_SUPPLIER_CONTACT_NOT_FOUND'
  static message = 'Supplier contact not found'
}
