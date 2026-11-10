import type ReferenceMatcher from '#shared/helpers/reference_matcher'

/**
 * Connecteurs de flux fournisseurs (catalogues réels importés par API / flux).
 * Voir `docs/supplier-feeds.md`.
 */
export const SUPPLIER_FEED_KEYS = ['pfconcept', 'passot', 'inspirion', 'axpol'] as const

export type SupplierFeedKey = (typeof SUPPLIER_FEED_KEYS)[number]

/** Langues demandables aux fournisseurs (intersection de ce qu'ils exposent). */
export const SUPPLIER_FEED_LOCALES = ['fr', 'en', 'de', 'es'] as const

export type SupplierFeedLocale = (typeof SUPPLIER_FEED_LOCALES)[number]

/** Fiche fournisseur créée / mise à jour à l'import. */
export interface SupplierFeedIdentity {
  slug: string
  name: string
  country: string
  website: string
}

export interface FetchCatalogueOptions {
  /** Nombre maximal de produits (modèles) renvoyés. */
  limit: number
  locale: SupplierFeedLocale
}

export interface NormalizedPriceTier {
  minQuantity: number
  unitPrice: number
}

export interface NormalizedImage {
  url: string
  role: 'primary' | 'view' | 'lifestyle' | 'marked'
}

export interface NormalizedVariant {
  sku: string
  /** Libellé couleur brut du fournisseur (rapproché des valeurs `color`). */
  colorLabel: string | null
  gtin: string | null
  stockQuantity: number | null
  /** Paliers propres à la variante (vide = prix du produit). */
  priceTiers: NormalizedPriceTier[]
  images: NormalizedImage[]
}

export interface NormalizedMarkingTechnique {
  /** Libellé brut du fournisseur (rapproché de `marking_techniques.synonyms`). */
  label: string
  maxColors: number | null
  setupCharge: number | null
  priceTiers: NormalizedPriceTier[]
}

export interface NormalizedMarkingPosition {
  name: string
  maxWidthMm: number | null
  maxHeightMm: number | null
  techniques: NormalizedMarkingTechnique[]
}

export interface NormalizedPackaging {
  packageType: string | null
  unitGrossWeightG: number | null
  outerCartonQty: number | null
  outerCartonLengthMm: number | null
  outerCartonWidthMm: number | null
  outerCartonHeightMm: number | null
  outerCartonGrossWeightG: number | null
}

/** Produit normalisé, indépendant du fournisseur, prêt à être persisté. */
export interface NormalizedProduct {
  /** Identifiant stable chez le fournisseur (code modèle / SKU parent). */
  externalId: string
  name: string
  description: string | null
  keywords: string[]
  brand: string | null
  hsCode: string | null
  /** Code ISO alpha-2 si reconnu, sinon `null`. */
  originCountry: string | null
  /** Catégorie brute du fournisseur, conservée pour traçabilité. */
  categoryRaw: string | null
  /** Libellés matière bruts (rapprochés des valeurs `material`). */
  materialLabels: string[]
  lifecycleStatus: 'active' | 'new' | 'end_of_series'
  leadTimeDays: number | null
  videoUrl: string | null
  currency: string
  priceTiers: NormalizedPriceTier[]
  variants: NormalizedVariant[]
  images: NormalizedImage[]
  markingPositions: NormalizedMarkingPosition[]
  packaging: NormalizedPackaging | null
}

/** Bilan d'un import, affiché par la commande. */
export interface SupplierImportSummary {
  supplier: SupplierFeedKey
  fetched: number
  created: number
  updated: number
  failed: number
  unmatchedCategories: string[]
  unmatchedTechniques: string[]
  errors: { externalId: string; message: string }[]
}

/** Nœud JSON quelconque d'un flux fournisseur (parcouru par `feed_tree`). */
export type FeedNode = Record<string, unknown>

/** PF Concept : ligne de marquage (`printFeedRow`) d'un article. */
export interface PfConceptPrintRow {
  location: string
  method: string
  printCode: string
  maxColors: number | null
  widthMm: number | null
  heightMm: number | null
}

/** PF Concept : prix d'appel d'un code d'impression (`decoCharge`). */
export interface PfConceptPrintPrice {
  setupCharge: number | null
  tiers: NormalizedPriceTier[]
}

/** PF Concept : prix nets d'un article. */
export interface PfConceptItemPrices {
  currency: string
  tiers: NormalizedPriceTier[]
}

/** Passot : produit parent et ses déclinaisons (regroupées par `main_sku`). */
export interface PassotProductGroup {
  parentSku: string
  parent: FeedNode | null
  children: FeedNode[]
}

/**
 * Entrée d'un référentiel rapprochable (catégorie, valeur d'attribut,
 * technique) : ses libellés connus (slug, nom traduit, synonymes). À longueur
 * de correspondance égale, la plus forte `priority` l'emporte (ex. catégorie
 * feuille plutôt que racine).
 */
export interface ReferenceEntry {
  id: number
  labels: string[]
  priority: number
}

/** Options d'import passées par la commande `supplier:import`. */
export interface SupplierImportOptions {
  limit: number
  locale: SupplierFeedLocale
  dryRun: boolean
  /** Copie les images dans Cellar (sinon l'URL fournisseur est conservée). */
  storeImages: boolean
  skipImages: boolean
}

/**
 * Référentiels chargés une fois par import pour rapprocher les libellés bruts.
 * `values` donne, pour une valeur d'attribut, son attribut et sa famille
 * (nuance → couleur parente).
 */
export interface SupplierReferences {
  categories: ReferenceMatcher
  colors: ReferenceMatcher
  materials: ReferenceMatcher
  techniques: ReferenceMatcher
  fallbackCategoryId: number
  values: Map<number, { attributeId: number; parentValueId: number | null; slug: string }>
}

/** Image retenue pour la galerie, éventuellement déjà copiée dans Cellar. */
export interface ResolvedSupplierImage {
  url: string
  role: NormalizedImage['role']
  storageObjectId: number | null
}
