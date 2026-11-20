import type ReferenceMatcher from '#shared/helpers/reference_matcher'

/**
 * Connecteurs de flux fournisseurs (catalogues réels importés par API / flux).
 * Voir `docs/supplier-feeds.md`.
 */
export const SUPPLIER_FEED_KEYS = ['pfconcept', 'passot', 'inspirion', 'makito'] as const

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

/** Cache disque d'un flux (`tmp/supplier_feeds/`), voir `SupplierHttpClient.getJson`. */
export interface FeedCacheOptions {
  /** Ignore la copie locale et retélécharge le flux. */
  refresh: boolean
  /**
   * Identité du compte quand les en-têtes changent à chaque exécution (jeton de
   * session) : remplace les en-têtes dans la clé de cache.
   */
  scope?: string
}

export interface FetchCatalogueOptions {
  /** Nombre maximal de produits (modèles) renvoyés ; `null` = catalogue entier. */
  limit: number | null
  locale: SupplierFeedLocale
  /** Retélécharge les flux au lieu de réutiliser le cache disque (`--refresh`). */
  refresh?: boolean
  /**
   * Appelé pour chaque flux annexe (prix, stock, marquage…) indisponible : le
   * catalogue est renvoyé sans ces données, à l'appelant de décider s'il l'écrit.
   */
  onMissingFeed?: (feed: string) => void
}

/** Contexte d'une lecture de flux annexe : cache et signalement d'un flux manquant. */
export interface FeedRequestContext {
  cache: FeedCacheOptions
  onMissingFeed?: (feed: string) => void
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
  /**
   * Fiches du fournisseur absentes d'un flux **complet** (`--full`, ou moins de
   * `--limit` produits récupérés), désactivées. Toujours 0 sur un flux tronqué.
   */
  deactivated: number
  /**
   * Fiches absentes du flux **non** désactivées parce qu'elles dépassent le
   * garde-fou de désactivation en masse (flux probablement amputé).
   */
  deactivationSkipped: number
  unmatchedCategories: string[]
  unmatchedTechniques: string[]
  /**
   * Flux annexes indisponibles (prix, stock, marquage…). Non vide sur un import
   * intégral = import annulé avant toute écriture.
   */
  missingFeeds: string[]
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

/** Prix nets d'un article et leur devise (PF Concept, Inspirion). */
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

/** Inspirion : flux annexes indexés par `article_id` (déclinaison), sauf mention contraire. */
export interface InspirionCatalogueIndex {
  prices: Map<string, PfConceptItemPrices>
  /** Stock disponible pour la France (`stock_france`). */
  stock: Map<string, number>
  /** Rubriques traduites (« parent > rubrique »). */
  categories: Map<string, string[]>
  /** Nœud `printdata` de l'article (positions, méthodes, codes d'impression). */
  printData: Map<string, FeedNode>
  /** Prix d'un code d'impression (`printcode`). */
  printPrices: Map<string, { setupCharge: number | null; tiers: NormalizedPriceTier[] }>
  /** Délai d'expédition en jours ouvrés (avec marquage si connu). */
  deliveryTimes: Map<string, number>
}

/** Makito : technique d'une zone de marquage (`/markings`), jointe par `technique_ref`. */
export interface MakitoMarkingRow {
  areaId: string
  techniqueRef: string
  maxColors: number | null
  widthMm: number | null
  heightMm: number | null
}

/**
 * Makito : flux annexes indexés une fois par import. Clé = `ref` produit, sauf
 * mention contraire.
 */
export interface MakitoCatalogueIndex {
  /** `/descriptionslang` : type d'article (« Foulard »), composition, infos. */
  sheets: Map<string, FeedNode>
  /** `/descriptionextlang` : description rédigée. */
  descriptions: Map<string, string>
  keywords: Map<string, string[]>
  categories: Map<string, string[]>
  variants: Map<string, FeedNode[]>
  /** Libellé couleur par `color_code`. */
  colors: Map<string, string>
  /** Stock disponible immédiatement, par `matnr`. */
  stock: Map<string, number>
  prices: Map<string, NormalizedPriceTier[]>
  images: Map<string, NormalizedImage[]>
  markings: Map<string, MakitoMarkingRow[]>
  /** Libellé de zone par `print_area_id`. */
  areaLabels: Map<string, string>
  /** Technique (`ref` produit + `technique_ref`) : libellé traduit. */
  techniqueLabels: Map<string, string>
  /** Prix d'une technique par `technique_ref`. */
  techniquePrices: Map<string, { setupCharge: number | null; tiers: NormalizedPriceTier[] }>
  /** Délai de marquage export le plus court (jours) par `technique_ref`. */
  leadTimes: Map<string, number>
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
  /** `null` = catalogue entier (`--full`). */
  limit: number | null
  locale: SupplierFeedLocale
  /** Retélécharge les flux au lieu de réutiliser le cache disque. */
  refresh?: boolean
  /** Désactive les fiches absentes même au-delà du garde-fou de masse. */
  allowMassDeactivation?: boolean
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
  /** URL d'affichage : copie Cellar avec `--store-images`, sinon l'URL source. */
  url: string
  /** URL d'origine chez le fournisseur (`product_images.source_url`). */
  sourceUrl: string
  role: NormalizedImage['role']
  storageObjectId: number | null
}
