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
 * Facette introuvable (administration des attributs, #48).
 */
export class AttributeNotFoundException extends Exception {
  static status = 404
  static code = 'E_ATTRIBUTE_NOT_FOUND'
  static message = 'Attribute not found'
}

/**
 * Valeur de facette introuvable pour l'attribut visé (#48).
 */
export class AttributeValueNotFoundException extends Exception {
  static status = 404
  static code = 'E_ATTRIBUTE_VALUE_NOT_FOUND'
  static message = 'Attribute value not found'
}

/**
 * Suppression d'une facette refusée : des produits la renseignent
 * (`product_attributes`) ou des catégories l'ont retenue (`category_attributes`).
 * `reason` choisit le message affiché.
 */
export class AttributeInUseException extends Exception {
  static status = 409
  static code = 'E_ATTRIBUTE_IN_USE'

  constructor(readonly reason: 'products' | 'categories') {
    super(`Attribute is in use (${reason})`)
  }
}

/**
 * Suppression d'une valeur refusée : des produits la portent, ou c'est une
 * famille de couleur qui a encore des nuances rattachées.
 */
export class AttributeValueInUseException extends Exception {
  static status = 409
  static code = 'E_ATTRIBUTE_VALUE_IN_USE'

  constructor(readonly reason: 'products' | 'children') {
    super(`Attribute value is in use (${reason})`)
  }
}

/**
 * Le slug d'une valeur est déjà pris par une autre valeur du même attribut
 * (unicité `(attribute_id, slug)`) : erreur de validation sur le champ `slug`.
 */
export function duplicateAttributeValueSlug() {
  return new errors.E_VALIDATION_ERROR([
    {
      field: 'slug',
      message: 'The slug has already been taken',
      rule: 'unique',
    },
  ])
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

/**
 * Marquage incohérent (écart 2) : technique inconnue, technique dupliquée sur une
 * position, palier de marquage dupliqué, ou gabarit (`templateDocumentId`) qui ne
 * pointe pas un document du produit de type `marking_template`. Erreur de
 * validation (422) rattachée au champ concerné, rendue comme les autres erreurs
 * de formulaire Inertia.
 */
export function invalidMarkingInput(field: string, message: string, rule: string) {
  return new errors.E_VALIDATION_ERROR([{ field, message, rule }])
}

// ─────────────────────────────────────────────────────────────────────────────
// Certifications et techniques de marquage (administration, #165)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Certification introuvable (administration des référentiels catalogue, #165).
 */
export class CertificationNotFoundException extends Exception {
  static status = 404
  static code = 'E_CERTIFICATION_NOT_FOUND'
  static message = 'Certification not found'
}

/**
 * Suppression d'une certification refusée : des produits la portent
 * (`product_certifications`).
 */
export class CertificationInUseException extends Exception {
  static status = 409
  static code = 'E_CERTIFICATION_IN_USE'

  constructor() {
    super('Certification is in use by products')
  }
}

/**
 * Technique de marquage introuvable (administration des référentiels, #165).
 */
export class MarkingTechniqueNotFoundException extends Exception {
  static status = 404
  static code = 'E_MARKING_TECHNIQUE_NOT_FOUND'
  static message = 'Marking technique not found'
}

/**
 * Suppression d'une technique de marquage refusée : des produits l'utilisent
 * (`product_marking_position_techniques`, `product_marking_price_tiers`).
 */
export class MarkingTechniqueInUseException extends Exception {
  static status = 409
  static code = 'E_MARKING_TECHNIQUE_IN_USE'

  constructor() {
    super('Marking technique is in use by products')
  }
}

/**
 * Pivot catégorie-attribut introuvable (administration, #165).
 */
export class CategoryAttributeNotFoundException extends Exception {
  static status = 404
  static code = 'E_CATEGORY_ATTRIBUTE_NOT_FOUND'
  static message = 'Category attribute not found'
}

/**
 * Attribut déjà associé à cette catégorie (unicité `(category_id, attribute_id)`).
 */
export class CategoryAttributeAlreadyExistsException extends Exception {
  static status = 409
  static code = 'E_CATEGORY_ATTRIBUTE_EXISTS'

  constructor() {
    super('This attribute is already associated with this category')
  }
}

/**
 * Plages de filtre invalides (min >= max ou attribut non numérique).
 */
export function invalidCategoryAttributeRanges(message: string) {
  return new errors.E_VALIDATION_ERROR([{ field: 'ranges', message, rule: 'ranges' }])
}
