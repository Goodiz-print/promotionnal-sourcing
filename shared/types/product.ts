import type { Locale } from './i18n.js'
import type { CategoryType } from './category.js'
import type { AttributeWithValuesType } from './attribute.js'

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
export type ProductType = {
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

/**
 * Filtres du catalogue public. `attributeValueIds` combine les facettes en
 * ET fiable (un produit doit porter *toutes* les valeurs sélectionnées).
 */
export type ProductDirectoryFilters = {
  search: string | null
  categoryId: number | null
  madeInEurope: boolean
  attributeValueIds: number[]
}

/**
 * Facettes exposées à la barre de filtres : catégories disponibles + attributs
 * filtrables avec leurs valeurs (déjà localisés).
 */
export type ProductCatalogueFacets = {
  categories: CategoryType[]
  attributes: AttributeWithValuesType[]
}

/**
 * Facette résolue d'un produit pour la fiche détaillée (nom d'attribut +
 * libellé de valeur, dans la locale active).
 */
export type ProductDetailAttributeType = {
  attributeSlug: string
  attributeName: string | null
  label: string | null
}

/**
 * Image de la galerie produit (sérialisée pour le frontend). Déclaré en
 * `type` — contrainte props Inertia `Record<string, JSONDataTypes>`.
 */
export type ProductImageType = {
  id: number
  url: string
  position: number
  width: number | null
  height: number | null
}

/**
 * Fiche produit détaillée (catalogue public) : le produit localisé + un
 * résumé du fournisseur/catégorie et la liste des facettes résolues.
 */
export type ProductDetailType = ProductType & {
  supplier: { slug: string; name: string | null; country: string }
  category: { slug: string; name: string | null } | null
  attributes: ProductDetailAttributeType[]
  // Galerie ordonnée (par `position`). `imageUrl` reste l'image principale.
  images: ProductImageType[]
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
