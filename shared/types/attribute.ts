import type { ContentLocale, Locale } from './i18n.js'

/**
 * Nature de la donnee portee par un attribut (facette).
 * `enum` : valeurs enumerees (couleur, matiere) ; `number` : mesure libre
 * (grammage) ; `string`/`boolean` : cas simples.
 */
export type AttributeDataType = 'string' | 'number' | 'boolean' | 'enum'

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
  createdAt: string
  updatedAt: string | null
}

export type AttributeWithValuesType = AttributeType & {
  values: AttributeValueType[]
}

export interface CreateAttributeData {
  slug: string
  type?: AttributeDataType
  unit?: string | null
  isFilterable?: boolean
  translations: Partial<Record<ContentLocale, { name: string }>>
}

export interface UpdateAttributeData extends Partial<CreateAttributeData> {}

export interface CreateAttributeValueData {
  attributeId: number
  value: string
  slug: string
  synonyms?: string[]
  translations: Partial<Record<ContentLocale, { label: string }>>
}

export interface UpdateAttributeValueData extends Partial<
  Omit<CreateAttributeValueData, 'attributeId'>
> {}
