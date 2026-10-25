import { Exception } from '@adonisjs/core/exceptions'
import { errors } from '@vinejs/vine'

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
 * Publication bloquée : la fiche ne renseigne pas tous les attributs marqués
 * `is_required_for_publication` par sa catégorie (ou un de ses ancêtres).
 * `missingSlugs` liste les attributs manquants, pour l'affichage fournisseur
 * « xx produits ont des informations manquantes » (écart 6 du plan).
 */
export class ProductPublicationBlockedException extends Exception {
  static status = 422
  static code = 'E_PRODUCT_PUBLICATION_BLOCKED'

  constructor(readonly missingSlugs: string[]) {
    super(
      `Publication bloquée : attribut(s) obligatoire(s) manquant(s) — ${missingSlugs.join(', ')}`
    )
  }
}

/**
 * Variantes / paliers de prix incohérents (SKU en double, palier dupliqué,
 * valeur d'attribut inconnue…). Erreur de validation (422) rattachée au champ
 * concerné, rendue comme les autres erreurs de formulaire Inertia.
 */
export function invalidVariantInput(field: string, message: string, rule: string) {
  return new errors.E_VALIDATION_ERROR([{ field, message, rule }])
}
