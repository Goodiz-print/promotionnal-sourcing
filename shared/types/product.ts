import type { ContentLocale, Locale } from './i18n.js'
import type { CategoryType } from './category.js'
import type { AttributeWithValuesType } from './attribute.js'
import type { ImageVariantType } from './image_variant.js'
import type { ProductDocumentFile } from './document.js'
import type { CertificationType } from './certification.js'

/**
 * Statut « cycle de vie » d'un produit (écart 5). Distinct de `isActive`, qui
 * reste le simple interrupteur de publication : un produit peut être `active` et
 * dépublié, ou `new` et publié.
 */
export const PRODUCT_LIFECYCLE_STATUSES = ['active', 'new', 'end_of_series', 'retired'] as const

export type ProductLifecycleStatus = (typeof PRODUCT_LIFECYCLE_STATUSES)[number]

export const DEFAULT_PRODUCT_LIFECYCLE_STATUS: ProductLifecycleStatus = 'active'

/**
 * Zone de provenance **dérivée** servant le filtre à 3 états (écart 9). Jamais
 * saisie : calculée à partir de `originCountry`/`madeInEurope` par
 * `ProductOriginService`. `null` (hors de cet enum) = origine inconnue, exclue
 * des cases France/Europe.
 */
export const ORIGIN_ZONES = ['france', 'europe', 'other'] as const

export type OriginZone = (typeof ORIGIN_ZONES)[number]

/**
 * Rôle d'une image de la galerie (écart 8) : principale, vue produit, mise en
 * situation, visuel marqué.
 */
export const PRODUCT_IMAGE_ROLES = ['primary', 'view', 'lifestyle', 'marked'] as const

export type ProductImageRole = (typeof PRODUCT_IMAGE_ROLES)[number]

/**
 * Fenêtre « Nouveautés » : un produit est neuf tant que `releasedAt` est à moins
 * de N jours. Sert à construire le seuil `releasedAfter` du filtre (écart 5).
 */
export const NEW_PRODUCT_WINDOW_DAYS = 90

/**
 * Traduction d'un produit (une ligne par locale). `keywords` et
 * `marketingPoints` sont des listes par locale (écart 5).
 */
export interface ProductTranslationType {
  locale: Locale
  name: string
  description: string | null
  keywords: string[] | null
  marketingPoints: string[] | null
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
  // Identité / classification (écart 5).
  brand: string | null
  hsCode: string | null
  isConfigurable: boolean
  lifecycleStatus: ProductLifecycleStatus
  releasedAt: string | null
  supplierCategoryRaw: string | null
  // Commercial (écart 7).
  leadTimeDays: number | null
  rushService: boolean
  rushLeadTimeDays: number | null
  // Médias (écart 8).
  videoUrl: string | null
  // Provenance dérivée (écart 9) — jamais saisie.
  originZone: OriginZone | null
  // Conformité (écart 4) : part de recyclé et mise en garde saisies ;
  // `isEco` est dérivé par la plateforme (jamais saisi).
  recycledContentPercent: number | null
  cautionComment: string | null
  isEco: boolean
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
  // Provenance à 3 états (écart 9) : les zones cochées se combinent en OU
  // (France OU Europe). Vide = pas de filtre de provenance.
  originZones: OriginZone[]
  // Filtre « Nouveautés » (écart 5) : produits sortis dans la fenêtre récente.
  newOnly: boolean
  // Filtre dérivé « Éco-responsable » (écart 4) : ne garde que les produits
  // `is_eco`. `false` = pas de filtre éco.
  ecoOnly: boolean
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
  // Rôle de l'image dans la galerie (écart 8) ; `null` = non typé.
  role: ProductImageRole | null
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
  // EAN/GTIN par variante (écart 5).
  gtin: string | null
  attributeValueIds: number[]
}

/**
 * Variante de la fiche publique : + facettes résolues dans la locale active.
 */
export type ProductDetailVariantType = ProductVariantType & {
  attributes: ProductDetailAttributeType[]
}

/**
 * Conditionnement / logistique produit (écart 3), sérialisé pour le frontend.
 * Relation 1:1 avec le produit : rarement filtré, donc colonnes simples (pas
 * d'EAV, pas de facette). `outerCartonVolumeM3` est un décimal sérialisé en
 * chaîne par Lucid, comme les autres colonnes decimal du projet.
 */
export type ProductPackagingType = {
  packageType: string | null
  unitGrossWeightG: number | null
  innerCartonQty: number | null
  outerCartonQty: number | null
  outerCartonLengthMm: number | null
  outerCartonWidthMm: number | null
  outerCartonHeightMm: number | null
  outerCartonGrossWeightG: number | null
  outerCartonVolumeM3: string | null
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
  // Labels de conformité résolus dans la locale active (écart 4).
  certifications: CertificationType[]
  // Galerie ordonnée (par `position`). `imageUrl` reste l'image principale.
  images: ProductImageType[]
  // Variantes actives et grille de prix dégressive.
  variants: ProductDetailVariantType[]
  priceTiers: ProductPriceTierType[]
  // Fiches techniques PDF (typées par nature, écart 4).
  documents: ProductDocumentFile[]
  // Conditionnement / logistique (écart 3) ; `null` si non renseigné.
  packaging: ProductPackagingType | null
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
  // Identité / classification (écart 5).
  brand: string | null
  hsCode: string | null
  isConfigurable: boolean
  lifecycleStatus: ProductLifecycleStatus
  releasedAt: string | null
  supplierCategoryRaw: string | null
  // Commercial (écart 7).
  leadTimeDays: number | null
  rushService: boolean
  rushLeadTimeDays: number | null
  // Médias (écart 8).
  videoUrl: string | null
  // Provenance dérivée (écart 9), lecture seule dans le formulaire.
  originZone: OriginZone | null
  // Conformité (écart 4) : saisies ; `isEco` dérivé, lecture seule.
  recycledContentPercent: number | null
  cautionComment: string | null
  isEco: boolean
  // Labels de conformité sélectionnés (écart 4), par identifiant.
  certificationIds: number[]
  // Langue saisie par le fournisseur ; les autres sont générées (`isAuto`).
  sourceLocale: ContentLocale
  translations: Record<
    ContentLocale,
    {
      name: string
      description: string | null
      isAuto: boolean
      keywords: string[] | null
      marketingPoints: string[] | null
    }
  >
  attributeValueIds: number[]
  images: ProductImageType[]
  variants: ProductVariantType[]
  priceTiers: ProductPriceTierType[]
  documents: ProductDocumentFile[]
  // Conditionnement / logistique (écart 3) ; `null` si non renseigné.
  packaging: ProductPackagingType | null
}

/**
 * Variante saisie. `imageId` : image **déjà en galerie** du produit.
 */
export interface ProductVariantInput {
  sku: string
  isActive?: boolean
  imageId?: number | null
  gtin?: string | null
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
 * Conditionnement / logistique saisi (écart 3). Tous les champs sont optionnels.
 * Dans le payload d'un produit, `packaging` **absent = inchangé** ; fourni, il
 * crée ou met à jour l'unique ligne 1:1 (les champs absents de l'objet fourni
 * sont remis à `null` — remplacement complet du bloc). Le volume est un nombre
 * (décimal) ; les poids / quantités / dimensions sont des entiers positifs.
 */
export interface ProductPackagingInput {
  packageType?: string | null
  unitGrossWeightG?: number | null
  innerCartonQty?: number | null
  outerCartonQty?: number | null
  outerCartonLengthMm?: number | null
  outerCartonWidthMm?: number | null
  outerCartonHeightMm?: number | null
  outerCartonGrossWeightG?: number | null
  outerCartonVolumeM3?: number | null
}

/**
 * Contenu saisi pour une locale (nom + description).
 */
export interface LocalizedProductContent {
  name: string
  description?: string | null
  // Mots-clés et arguments marketing par locale (écart 5).
  keywords?: string[] | null
  marketingPoints?: string[] | null
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
  // Identité / classification (écart 5).
  brand?: string | null
  hsCode?: string | null
  isConfigurable?: boolean
  lifecycleStatus?: ProductLifecycleStatus
  releasedAt?: string | null
  supplierCategoryRaw?: string | null
  // Commercial (écart 7).
  leadTimeDays?: number | null
  rushService?: boolean
  rushLeadTimeDays?: number | null
  // Médias (écart 8).
  videoUrl?: string | null
  // Conformité (écart 4). `isEco` n'est PAS saisissable (dérivé).
  recycledContentPercent?: number | null
  cautionComment?: string | null
  certificationIds?: number[]
  attributeValueIds?: number[]
  variants?: ProductVariantInput[]
  priceTiers?: ProductPriceTierInput[]
  // Conditionnement / logistique (écart 3). Absent = inchangé.
  packaging?: ProductPackagingInput
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
  // Identité / classification (écart 5).
  brand?: string | null
  hsCode?: string | null
  isConfigurable?: boolean
  lifecycleStatus?: ProductLifecycleStatus
  releasedAt?: string | null
  supplierCategoryRaw?: string | null
  // Commercial (écart 7).
  leadTimeDays?: number | null
  rushService?: boolean
  rushLeadTimeDays?: number | null
  // Médias (écart 8).
  videoUrl?: string | null
  // Conformité (écart 4). `isEco` n'est PAS saisissable (dérivé).
  recycledContentPercent?: number | null
  cautionComment?: string | null
  // Absent = inchangé ; tableau = remplace l'ensemble des labels.
  certificationIds?: number[]
  attributeValueIds?: number[]
  // Absent = inchangé ; tableau = remplace l'ensemble (variantes par SKU).
  variants?: ProductVariantInput[]
  priceTiers?: ProductPriceTierInput[]
  // Conditionnement / logistique (écart 3). Absent = inchangé.
  packaging?: ProductPackagingInput
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
