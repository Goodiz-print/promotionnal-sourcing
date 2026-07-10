import type { Locale } from './i18n.js'

/**
 * Traduction d'un produit (une ligne par locale).
 */
export interface ProductTranslationType {
  locale: Locale
  name: string
  description: string | null
}

/**
 * Produit sérialisé pour le frontend : `name`/`description` sont déjà
 * résolus dans la locale active par le transformer.
 */
export interface ProductType {
  id: number
  supplierId: number
  categoryId: number
  name: string | null
  slug: string
  reference: string | null
  description: string | null
  // Colonnes decimal serialisees en chaine par Lucid.
  priceMin: string | null
  priceMax: string | null
  currency: string
  minQuantity: number | null
  imageUrl: string | null
  originCountry: string | null
  madeInEurope: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string | null
}

/**
 * Facette portee par un produit (ligne du pivot product_attributes).
 * `attributeValueId` : valeur enumeree (couleur=bleu) ; `valueNumber` :
 * mesure libre (grammage) sans valeur enumeree.
 */
export interface ProductAttributeValueType {
  attributeId: number
  attributeValueId: number | null
  valueNumber: string | null
  valueString: string | null
}

export interface CreateProductData {
  supplierId: number
  categoryId: number
  slug: string
  reference?: string | null
  priceMin?: number | null
  priceMax?: number | null
  currency?: string
  minQuantity?: number | null
  imageUrl?: string | null
  originCountry?: string | null
  madeInEurope?: boolean
  isActive?: boolean
  // Contenu traduit : au moins la locale par défaut.
  translations: Partial<Record<Locale, { name: string; description?: string | null }>>
}

export interface UpdateProductData extends Partial<CreateProductData> {}
