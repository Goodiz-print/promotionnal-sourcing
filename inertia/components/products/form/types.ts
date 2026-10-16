import type { InjectionKey } from 'vue'
import type { InertiaForm } from '@inertiajs/vue3'
import type { ContentLocale } from '#shared/types/i18n'

/**
 * État du formulaire produit fournisseur (payload `useForm`). Les prix sont des
 * `number | null` (coercés par VineJS) ; `images` porte les nouveaux fichiers,
 * `removedImageIds` les images existantes à supprimer.
 */
export interface ProductFormState {
  categoryId: number | null
  translations: Record<ContentLocale, { name: string; description: string }>
  priceMin: number | null
  priceMax: number | null
  currency: string
  minQuantity: number | null
  originCountry: string
  madeInEurope: boolean
  isActive: boolean
  attributeValueIds: number[]
  images: File[]
  removedImageIds: number[]
}

/**
 * Le formulaire est partagé aux sections via provide/inject (et non en prop) :
 * une valeur injectée n'est pas un prop, donc sa mutation par les sections est
 * légitime (pas de `vue/no-mutating-props`).
 */
export const ProductFormKey: InjectionKey<InertiaForm<ProductFormState>> = Symbol('productForm')
