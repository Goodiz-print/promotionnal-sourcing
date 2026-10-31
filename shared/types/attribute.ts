import type { ContentLocale, Locale } from './i18n.js'

/**
 * Nature de la donnee portee par un attribut (facette).
 * `enum` : valeurs enumerees (couleur, matiere) ; `number` : mesure libre
 * (grammage) ; `string`/`boolean` : cas simples.
 */
export const ATTRIBUTE_DATA_TYPES = ['string', 'number', 'boolean', 'enum'] as const
export type AttributeDataType = (typeof ATTRIBUTE_DATA_TYPES)[number]

export interface AttributeTranslationType {
  locale: Locale
  name: string
}

export interface AttributeValueTranslationType {
  locale: Locale
  label: string
}

/**
 * Déclarés en `type` (et non `interface`) pour rester assignables aux props
 * Inertia (`Record<string, JSONDataTypes>`) : une interface n'a pas de
 * signature d'index implicite.
 */
export type AttributeType = {
  id: number
  name: string | null
  slug: string
  type: AttributeDataType
  unit: string | null
  isFilterable: boolean
  createdAt: string
  updatedAt: string | null
}

export type AttributeValueType = {
  id: number
  attributeId: number
  value: string
  label: string | null
  slug: string
  synonyms: string[]
  /** Code couleur `#RRGGBB` pour la pastille à l'écran (couleurs uniquement). */
  hex: string | null
  /**
   * Couleur à 2 niveaux : identifiant de la valeur famille (N1) d'une nuance
   * (N2). `null` pour une valeur sans parent (familles, matières…).
   */
  parentValueId: number | null
  createdAt: string
  updatedAt: string | null
}

export type AttributeWithValuesType = AttributeType & {
  values: AttributeValueType[]
}

/**
 * Création d'une facette (administration, #48). Le `type` et le `slug` sont
 * figés ensuite : les produits, les filtres et les URLs s'appuient dessus.
 * Seule la traduction de `sourceLocale` est requise, les autres langues sont
 * générées (#75).
 */
export interface CreateAttributeData {
  slug: string
  type: AttributeDataType
  unit?: string | null
  isFilterable?: boolean
  sourceLocale: ContentLocale
  translations: Partial<Record<ContentLocale, { name: string }>>
}

export interface UpdateAttributeData {
  unit?: string | null
  isFilterable?: boolean
  sourceLocale?: ContentLocale
  translations?: Partial<Record<ContentLocale, { name?: string }>>
}

/**
 * Création d'une valeur de facette. La valeur canonique (`value`, utilisée par
 * le filtrage) reprend le `slug`, figé ensuite.
 */
export interface CreateAttributeValueData {
  slug: string
  sourceLocale: ContentLocale
  synonyms?: string[]
  translations: Partial<Record<ContentLocale, { label: string }>>
}

export interface UpdateAttributeValueData {
  sourceLocale?: ContentLocale
  synonyms?: string[]
  translations?: Partial<Record<ContentLocale, { label?: string }>>
}

/**
 * Ligne de la liste d'administration des facettes. Déclaré en `type` (props
 * Inertia).
 */
export type AttributeAdminType = {
  id: number
  slug: string
  name: string | null
  type: AttributeDataType
  unit: string | null
  isFilterable: boolean
  valuesCount: number
  /** Nombre de produits qui renseignent cette facette. */
  productsCount: number
}

/**
 * Valeur éditée en ligne : seul le libellé de sa langue source est modifiable
 * dans l'écran, les autres langues sont générées.
 */
export type AttributeValueEditType = {
  id: number
  slug: string
  sourceLocale: ContentLocale
  /** Libellé dans `sourceLocale` (chaîne vide si absent). */
  label: string
  synonyms: string[]
  /** Valeur utilisée par des produits : suppression refusée. */
  productsCount: number
}

export type AttributeEditType = {
  id: number
  slug: string
  type: AttributeDataType
  unit: string | null
  isFilterable: boolean
  sourceLocale: ContentLocale
  translations: Record<ContentLocale, { name: string; isAuto: boolean }>
  values: AttributeValueEditType[]
}
