import type { ModerationStatus } from './moderation.js'
import type { ProductLifecycleStatus, ProductStockStatus, ProductImageType } from './product.js'
import type { ContentLocale } from './i18n.js'

/**
 * Administration du catalogue produits (#164).
 * Types exposés en props Inertia : des `type`, pas des `interface`.
 */

/** Valeurs du filtre de visibilité */
export const ADMIN_PRODUCT_VISIBILITY_FILTERS = [
  'published',
  'unpublished',
  'hidden',
  'archived',
] as const

export type AdminProductVisibilityFilter = (typeof ADMIN_PRODUCT_VISIBILITY_FILTERS)[number]

/** Valeurs du filtre de qualité */
export const ADMIN_PRODUCT_QUALITY_FILTERS = ['no_image', 'no_translation', 'no_variant'] as const

export type AdminProductQualityFilter = (typeof ADMIN_PRODUCT_QUALITY_FILTERS)[number]

/** Filtres de la liste des produits (query string, tous optionnels). */
export type AdminProductIndexFilters = {
  /** Recherche partielle sur nom traduit, slug, SKU de variante ou nom d'organisation. `null` = aucune. */
  search: string | null
  /** ID du fournisseur (organisation). `null` = tous. */
  supplierId: number | null
  /** ID de la catégorie (inclut les sous-catégories). `null` = toutes. */
  categoryId: number | null
  /** Statut de visibilité calculé. `null` = tous. */
  visibility: AdminProductVisibilityFilter | null
  /** Filtre de qualité. `null` = tous. */
  quality: AdminProductQualityFilter | null
}

/** Options de la liste produits passees en props Inertia pour les filtres. */
export type AdminProductFilterOptions = {
  categories: AdminProductCategoryOption[]
  suppliers: AdminProductSupplierOption[]
}

/** Option de catégorie pour le filtre. */
export type AdminProductCategoryOption = {
  id: number
  name: string
  depth: number
}

/** Option de fournisseur pour le filtre. */
export type AdminProductSupplierOption = {
  id: number
  name: string
}

/** Statut de visibilité calculé d'un produit. */
export type AdminProductVisibilityStatus = 'published' | 'unpublished' | 'hidden' | 'archived'

/** Ligne de la liste des produits. */
export type AdminProductListItem = {
  id: number
  name: string | null
  slug: string
  supplierName: string | null
  supplierOrganizationId: number | null
  categoryName: string | null
  visibilityStatus: AdminProductVisibilityStatus
  variantsCount: number
  imagesCount: number
  stockStatus: ProductStockStatus | null
  createdAt: string
}

/** Variante d'un produit (fiche admin). */
export type AdminProductVariant = {
  id: number
  sku: string
  stockStatus: ProductStockStatus | null
  isActive: boolean
}

/** Palier de prix (fiche admin). */
export type AdminProductPriceTier = {
  id: number
  variantId: number | null
  minQuantity: number
  unitPrice: string
  currency: string
}

/** Traduction d'un produit (fiche admin). */
export type AdminProductTranslation = {
  locale: ContentLocale
  name: string | null
  hasDescription: boolean
}

/** Certification d'un produit (fiche admin). */
export type AdminProductCertification = {
  id: number
  slug: string
  name: string | null
}

/** Attribut d'un produit (fiche admin). */
export type AdminProductAttribute = {
  attributeSlug: string
  attributeName: string | null
  label: string | null
}

/** Historique de modération (fiche admin). */
export type AdminProductModerationHistory = {
  id: number
  status: ModerationStatus
  reason: string | null
  decidedByEmail: string | null
  decidedAt: string
}

/** Fiche complete d'un produit. */
export type AdminProductDetail = AdminProductListItem & {
  isActive: boolean
  lifecycleStatus: ProductLifecycleStatus
  moderationStatus: ModerationStatus
  moderationHistory: AdminProductModerationHistory[]
  variants: AdminProductVariant[]
  priceTiers: AdminProductPriceTier[]
  images: ProductImageType[]
  translations: AdminProductTranslation[]
  certifications: AdminProductCertification[]
  attributes: AdminProductAttribute[]
  supplierSlug: string | null
  categorySlug: string | null
  /** Flags d'actions autorisées pour l'utilisateur courant. */
  canManage: boolean
}

/** Actions possibles sur un produit. */
export const ADMIN_PRODUCT_ACTIONS = [
  'hide',
  'unhide',
  'unpublish',
  'publish',
  'archive',
  'restore',
  'reindex',
] as const

export type AdminProductAction = (typeof ADMIN_PRODUCT_ACTIONS)[number]
