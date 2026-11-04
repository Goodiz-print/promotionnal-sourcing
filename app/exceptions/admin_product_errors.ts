import { Exception } from '@adonisjs/core/exceptions'

/**
 * Produit introuvable dans le back-office (`/admin/products/:id`).
 */
export class AdminProductNotFoundException extends Exception {
  static status = 404
  static code = 'E_ADMIN_PRODUCT_NOT_FOUND'
  static message = 'Product not found'
}

/**
 * Tentative de masquage d'un produit deja masque (derniere decision = rejected).
 */
export class ProductAlreadyHiddenException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_ALREADY_HIDDEN'
  static message = 'This product is already hidden'
}

/**
 * Tentative de reveler un produit qui n'est pas masque.
 */
export class ProductNotHiddenException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_NOT_HIDDEN'
  static message = 'This product is not hidden'
}

/**
 * Tentative de depublier un produit deja depublie (is_active=false).
 */
export class ProductAlreadyUnpublishedException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_ALREADY_UNPUBLISHED'
  static message = 'This product is already unpublished'
}

/**
 * Tentative de publier un produit deja publie (is_active=true).
 */
export class ProductAlreadyPublishedException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_ALREADY_PUBLISHED'
  static message = 'This product is already published'
}

/**
 * Tentative d'archiver un produit deja archive (lifecycle_status='retired').
 */
export class ProductAlreadyArchivedException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_ALREADY_ARCHIVED'
  static message = 'This product is already archived'
}

/**
 * Tentative de restaurer un produit qui n'est pas archive.
 */
export class ProductNotArchivedException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_NOT_ARCHIVED'
  static message = 'This product is not archived'
}
