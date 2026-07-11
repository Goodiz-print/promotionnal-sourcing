import { Exception } from '@adonisjs/core/exceptions'

/**
 * Produit introuvable (ou inactif) dans le catalogue public.
 * Rendue en page 404 via le status page du handler.
 */
export class ProductNotFoundException extends Exception {
  static status = 404
  static code = 'E_PRODUCT_NOT_FOUND'
  static message = 'Product not found'
}
