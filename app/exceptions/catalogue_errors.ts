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

/**
 * Catégorie introuvable (administration de la taxonomie).
 * Rendue en page 404 via le status page du handler.
 */
export class CategoryNotFoundException extends Exception {
  static status = 404
  static code = 'E_CATEGORY_NOT_FOUND'
  static message = 'Category not found'
}

/**
 * Le contenu fourni ne contient pas la langue source du produit (#75) : la
 * traduction automatique n'a rien à traduire.
 */
export class MissingSourceContentException extends Exception {
  static status = 422
  static code = 'E_SOURCE_CONTENT_MISSING'
  static message = 'The product content must include its source language'
}
