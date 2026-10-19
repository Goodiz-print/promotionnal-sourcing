import type { ContentLocale, Locale } from './i18n.js'
import type { CategoryType } from './category.js'
import type { AttributeWithValuesType } from './attribute.js'
import type { ImageVariantType } from './image_variant.js'
import type { DocumentType } from './document.js'

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
 * Tri du catalogue : défaut par slug ; `price_asc` par prix du premier palier.
 */
export type ProductSort = 'price_asc'

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
  // Variantes redimensionnées disponibles (vide tant que le job n'a pas tourné).
  variants: ImageVariantType[]
}

/**
 * Variante d'un produit (rouge / L…) identifiée par son SKU. `imageId` pointe
 * une image de la galerie (affichée quand la variante est choisie).
 */
export type ProductVariantType = {
  id: number
  sku: string
  isActive: boolean
  imageId: number | null
  attributeValueIds: number[]
}

/**
 * Variante de la fiche publique : + facettes résolues dans la locale active.
 */
export type ProductDetailVariantType = ProductVariantType & {
  attributes: ProductDetailAttributeType[]
}

/**
 * Palier de prix : à partir de `minQuantity` pièces, `unitPrice` par pièce.
 * `variantId` null = palier du produit (toutes variantes). Décimal sérialisé
 * en chaîne par Lucid.
 */
export type ProductPriceTierType = {
  id: number
  variantId: number | null
  minQuantity: number
  unitPrice: string
  currency: string
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
  // Variantes actives et grille de prix dégressive.
  variants: ProductDetailVariantType[]
  priceTiers: ProductPriceTierType[]
  // Fiches techniques PDF.
  documents: DocumentType[]
}

/**
 * Produit tel qu'exposé au formulaire d'édition fournisseur : traductions par
 * locale (les deux), facettes sélectionnées et galerie. Déclaré en `type`
 * (contrainte props Inertia).
 */
export type ProductEditType = {
  id: number
  slug: string
  categoryId: number
  priceMin: string | null
  priceMax: string | null
  currency: string
  minQuantity: number | null
  originCountry: string | null
  madeInEurope: boolean
  isActive: boolean
  // Langue saisie par le fournisseur ; les autres sont générées (`isAuto`).
  sourceLocale: ContentLocale
  translations: Record<ContentLocale, { name: string; description: string | null; isAuto: boolean }>
  attributeValueIds: number[]
  images: ProductImageType[]
  variants: ProductVariantType[]
  priceTiers: ProductPriceTierType[]
  documents: DocumentType[]
}

/**
 * Variante saisie. `imageId` : image **déjà en galerie** du produit.
 */
export interface ProductVariantInput {
  sku: string
  isActive?: boolean
  imageId?: number | null
  attributeValueIds?: number[]
}

/**
 * Palier saisi. `variantSku` absent/null = palier du produit ; sinon palier de
 * la variante portant ce SKU (résolu par le service).
 */
export interface ProductPriceTierInput {
  variantSku?: string | null
  minQuantity: number
  unitPrice: number
}

/**
 * Contenu saisi pour une locale (nom + description).
 */
export interface LocalizedProductContent {
  name: string
  description?: string | null
}

/**
 * Payload validé de création (formulaire fournisseur). `sourceLocale` est la
 * langue saisie : seule sa traduction est requise, les autres sont optionnelles
 * (les manquantes sont générées automatiquement). Les fichiers image sont
 * traités hors de ce type.
 */
export interface SupplierProductInput {
  categoryId: number
  sourceLocale: ContentLocale
  translations: Partial<Record<ContentLocale, LocalizedProductContent>>
  priceMin?: number | null
  priceMax?: number | null
  currency?: string
  minQuantity?: number | null
  originCountry?: string | null
  madeInEurope?: boolean
  isActive?: boolean
  attributeValueIds?: number[]
  variants?: ProductVariantInput[]
  priceTiers?: ProductPriceTierInput[]
}

/**
 * Payload validé de mise à jour : partiel. Un champ absent n'est pas modifié
 * (`attributeValueIds` absent = facettes conservées). Une seule locale peut être
 * corrigée sans renvoyer le produit.
 */
export interface SupplierProductUpdateInput {
  categoryId?: number
  sourceLocale?: ContentLocale
  translations?: Partial<Record<ContentLocale, Partial<LocalizedProductContent>>>
  priceMin?: number | null
  priceMax?: number | null
  currency?: string
  minQuantity?: number | null
  originCountry?: string | null
  madeInEurope?: boolean
  isActive?: boolean
  attributeValueIds?: number[]
  // Absent = inchangé ; tableau = remplace l'ensemble (variantes par SKU).
  variants?: ProductVariantInput[]
  priceTiers?: ProductPriceTierInput[]
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
  translations: Partial<Record<ContentLocale, { name: string; description?: string | null }>>
}

export interface UpdateProductData extends Partial<CreateProductData> {}
