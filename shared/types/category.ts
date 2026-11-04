import type { ContentLocale, Locale } from './i18n.js'
import type { AttributeDataType, AttributeValueType } from './attribute.js'

export interface CategoryTranslationType {
  locale: Locale
  name: string
  description: string | null
}

/**
 * Déclaré en `type` (et non `interface`) pour rester assignable aux props
 * Inertia (`Record<string, JSONDataTypes>`) : une interface n'a pas de
 * signature d'index implicite.
 */
export type CategoryType = {
  id: number
  name: string | null
  slug: string
  parentId: number | null
  description: string | null
  synonyms: string[]
  createdAt: string
  updatedAt: string | null
}

/**
 * Une tranche de filtre (ex. contenance « 400-600 ml »). Le libellé n'est pas
 * stocké : il se rend depuis les bornes + l'unité de l'attribut + la locale.
 * Une borne `null` est ouverte (`< 400` : `minValue` null ; `> 900` : `maxValue`
 * null).
 */
export interface CategoryAttributeRangeType {
  minValue: number | null
  maxValue: number | null
}

/**
 * Attribut filtrable résolu pour une catégorie (`CatalogueFacetsService`) :
 * attribut propre ou hérité d'un ancêtre, avec ses valeurs énumérées et ses
 * tranches. Déclaré en `type` (contrainte props Inertia).
 */
export type CategoryAttributeType = {
  attributeId: number
  slug: string
  name: string | null
  type: AttributeDataType
  unit: string | null
  isRequiredForPublication: boolean
  isFilter: boolean
  position: number
  /** Catégorie à laquelle l'attribut est rattaché (propre ou ancêtre). */
  categoryId: number
  values: AttributeValueType[]
  ranges: CategoryAttributeRangeType[]
}

/**
 * Valeur d'une facette dans la barre de filtres, avec son **compteur** issu de
 * la distribution de facettes du moteur. `count` vaut `null` quand les compteurs
 * ne sont pas disponibles (moteur de recherche inerte) : l'UI affiche alors la
 * valeur sans badge. Déclaré en `type` (contrainte props Inertia).
 */
export type CategoryFacetValueType = AttributeValueType & { count: number | null }

/**
 * Tranche d'un attribut numérique dans la barre de filtres, avec son compteur
 * (somme de la distribution des valeurs comprises dans la tranche). Champs
 * réénumérés (et non `CategoryAttributeRangeType & …`) : une `interface` n'a pas
 * de signature d'index implicite et ne serait pas assignable aux props Inertia.
 */
export type CategoryFacetRangeType = {
  minValue: number | null
  maxValue: number | null
  count: number | null
}

/**
 * Attribut filtrable d'une catégorie prêt pour la barre de filtres : l'attribut
 * résolu (`CatalogueFacetsService`) enrichi des compteurs de la distribution de
 * facettes (`facetDistribution`). Déclaré en `type` (contrainte props Inertia).
 */
export type CategoryFacetType = {
  attributeId: number
  slug: string
  name: string | null
  type: AttributeDataType
  unit: string | null
  position: number
  values: CategoryFacetValueType[]
  ranges: CategoryFacetRangeType[]
}

/**
 * Barre de filtres dépendante de la catégorie : les attributs filtrables résolus
 * (propres + hérités) avec leurs compteurs. `hasCounts` est `false` quand le
 * moteur de recherche est indisponible (compteurs `null`, aucun filtrage par
 * disponibilité côté UI). Déclaré en `type` (contrainte props Inertia).
 */
export type CategoryFacetBarType = {
  attributes: CategoryFacetType[]
  hasCounts: boolean
}

/**
 * Catégorie telle qu'affichée dans la liste d'administration : nom résolu dans
 * la locale active, nom du parent, et nombre de produits rattachés. Déclaré en
 * `type` (contrainte props Inertia).
 */
export type CategoryAdminType = {
  id: number
  slug: string
  name: string | null
  parentId: number | null
  parentName: string | null
  productsCount: number
}

/**
 * Catégorie exposée au formulaire d'édition : traductions par locale (toutes),
 * slug, parent et synonymes. Déclaré en `type` (contrainte props Inertia).
 */
export type CategoryEditType = {
  id: number
  slug: string
  parentId: number | null
  synonyms: string[]
  sourceLocale: ContentLocale
  translations: Record<ContentLocale, { name: string; description: string | null; isAuto: boolean }>
}

/**
 * Contenu localisé d'une catégorie (une entrée par locale).
 */
export interface CategoryTranslationInput {
  name: string
  description?: string | null
}

/**
 * Payload de création d'une catégorie (langue source requise, autres générées).
 */
export interface CreateCategoryInput {
  slug: string
  parentId?: number | null
  synonyms?: string[]
  sourceLocale: ContentLocale
  translations: Partial<Record<ContentLocale, CategoryTranslationInput>>
}

/**
 * Payload de mise à jour : le slug n'est pas modifiable (préserve URLs/facettes).
 */
export interface UpdateCategoryInput {
  parentId?: number | null
  synonyms?: string[]
  sourceLocale?: ContentLocale
  translations?: Partial<Record<ContentLocale, Partial<CategoryTranslationInput>>>
}

// ─────────────────────────────────────────────────────────────────────────────
// Administration des attributs associés aux catégories (#165)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tranche d'attribut numérique dans l'écran d'édition (admin). Identique à
 * `CategoryAttributeRangeType` mais avec un id pour l'édition.
 */
export type CategoryAttributeRangeEditType = {
  id: number
  minValue: number | null
  maxValue: number | null
  position: number
}

/**
 * Attribut associé à une catégorie pour l'écran d'édition admin : les champs
 * du pivot `category_attributes` + le nom de l'attribut résolu + les plages.
 */
export type CategoryAttributeEditType = {
  id: number
  attributeId: number
  slug: string
  name: string | null
  type: AttributeDataType
  unit: string | null
  isRequiredForPublication: boolean
  isFilter: boolean
  position: number
  ranges: CategoryAttributeRangeEditType[]
}

/**
 * Ajout d'un attribut à une catégorie (pivot `category_attributes`).
 */
export interface AddCategoryAttributeData {
  attributeId: number
  isRequiredForPublication?: boolean
  isFilter?: boolean
  position?: number
}

/**
 * Mise à jour du pivot catégorie-attribut.
 */
export interface UpdateCategoryAttributeData {
  isRequiredForPublication?: boolean
  isFilter?: boolean
  position?: number
}

/**
 * Tranche d'un attribut numérique sur une catégorie : min/max sont des nombres
 * (nullable = borne ouverte). Validation : minValue < maxValue si les deux
 * sont présents.
 */
export interface CategoryAttributeRangeInput {
  minValue?: number | null
  maxValue?: number | null
}

/**
 * Mise à jour des plages d'un attribut numérique associé à une catégorie.
 * Le tableau remplace les plages existantes (synchronisation complète).
 */
export interface UpdateCategoryAttributeRangesData {
  ranges: CategoryAttributeRangeInput[]
}
