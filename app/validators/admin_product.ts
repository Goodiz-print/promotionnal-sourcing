import vine from '@vinejs/vine'
import {
  ADMIN_PRODUCT_VISIBILITY_FILTERS,
  ADMIN_PRODUCT_QUALITY_FILTERS,
} from '#shared/types/admin_product'

/**
 * Filtres de la liste des produits (query string), tous optionnels.
 * Une valeur invalide est refusee en 422.
 */
export const adminProductFiltersValidator = vine.create({
  search: vine.string().trim().maxLength(255).optional(),
  supplierId: vine.number().withoutDecimals().min(1).optional(),
  categoryId: vine.number().withoutDecimals().min(1).optional(),
  visibility: vine.enum(ADMIN_PRODUCT_VISIBILITY_FILTERS).optional(),
  quality: vine.enum(ADMIN_PRODUCT_QUALITY_FILTERS).optional(),
  page: vine.number().withoutDecimals().min(1).max(100000).optional(),
})

/**
 * Donnees de l'action "hide" : motif obligatoire.
 */
export const adminProductHideValidator = vine.create({
  reason: vine.string().trim().minLength(1).maxLength(2000),
})
