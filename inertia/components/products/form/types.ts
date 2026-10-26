import type { InjectionKey } from 'vue'
import type { InertiaForm } from '@inertiajs/vue3'
import type { ContentLocale } from '#shared/types/i18n'
import type { ProductLifecycleStatus } from '#shared/types/product'

/**
 * Ligne de variante du formulaire (`imageId` : image déjà en galerie).
 */
export interface ProductVariantFormRow {
  sku: string
  isActive: boolean
  imageId: number | null
  gtin: string
  attributeValueIds: number[]
}

/**
 * Ligne de palier du formulaire (`variantSku` vide = palier du produit).
 */
export interface ProductPriceTierFormRow {
  variantSku: string
  minQuantity: number | null
  unitPrice: number | null
}

/**
 * Conditionnement / logistique du formulaire (écart 3). Champs numériques en
 * `number | null` (coercés par VineJS, `null` = non renseigné).
 */
export interface ProductPackagingFormState {
  packageType: string
  unitGrossWeightG: number | null
  innerCartonQty: number | null
  outerCartonQty: number | null
  outerCartonLengthMm: number | null
  outerCartonWidthMm: number | null
  outerCartonHeightMm: number | null
  outerCartonGrossWeightG: number | null
  outerCartonVolumeM3: number | null
}

/**
 * État du formulaire produit fournisseur (payload `useForm`). Les prix sont des
 * `number | null` (coercés par VineJS) ; `images` porte les nouveaux fichiers,
 * `removedImageIds` les images existantes à supprimer. `sourceLocale` est la
 * langue saisie ; les autres sont générées automatiquement si laissées vides.
 */
export interface ProductFormState {
  categoryId: number | null
  sourceLocale: ContentLocale
  translations: Record<ContentLocale, { name: string; description: string }>
  priceMin: number | null
  priceMax: number | null
  currency: string
  minQuantity: number | null
  originCountry: string
  madeInEurope: boolean
  isActive: boolean
  // Identité / classification (écart 5). `originZone` reste dérivée, non éditable.
  brand: string
  hsCode: string
  isConfigurable: boolean
  lifecycleStatus: ProductLifecycleStatus
  releasedAt: string
  supplierCategoryRaw: string
  // Commercial (écart 7).
  leadTimeDays: number | null
  rushService: boolean
  rushLeadTimeDays: number | null
  // Médias (écart 8).
  videoUrl: string
  // Conformité (écart 4) : `isEco` reste dérivé, non éditable.
  recycledContentPercent: number | null
  cautionComment: string
  certificationIds: number[]
  attributeValueIds: number[]
  images: File[]
  removedImageIds: number[]
  variants: ProductVariantFormRow[]
  priceTiers: ProductPriceTierFormRow[]
  // Conditionnement / logistique (écart 3).
  packaging: ProductPackagingFormState
}

/**
 * Le formulaire est partagé aux sections via provide/inject (et non en prop) :
 * une valeur injectée n'est pas un prop, donc sa mutation par les sections est
 * légitime (pas de `vue/no-mutating-props`).
 */
export const ProductFormKey: InjectionKey<InertiaForm<ProductFormState>> = Symbol('productForm')
