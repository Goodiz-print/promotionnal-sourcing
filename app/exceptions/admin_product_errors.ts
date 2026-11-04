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
 * Tentative de masquage d'un produit déjà masqué (dernière décision = rejected).
 */
export class ProductAlreadyHiddenException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_ALREADY_HIDDEN'
  static message = 'This product is already hidden'
}

/**
 * Tentative de révéler un produit qui n'est pas masqué.
 */
export class ProductNotHiddenException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_NOT_HIDDEN'
  static message = 'This product is not hidden'
}

/**
 * Tentative de dépublier un produit déjà dépublié (is_active=false).
 */
export class ProductAlreadyUnpublishedException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_ALREADY_UNPUBLISHED'
  static message = 'This product is already unpublished'
}

/**
 * Tentative de publier un produit déjà publié (is_active=true).
 */
export class ProductAlreadyPublishedException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_ALREADY_PUBLISHED'
  static message = 'This product is already published'
}

/**
 * Tentative de publier un produit archivé : il faut d'abord le restaurer.
 */
export class ProductArchivedException extends Exception {
  static status = 409
  static code = 'E_PRODUCT_ARCHIVED'
  static message = 'This product is archived: restore it before publishing'
}

/**
 * Tentative d'archiver un produit déjà archivé (lifecycle_status='retired').
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
