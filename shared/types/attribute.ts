import type { Locale } from './i18n.js'

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

export interface AttributeType {
  id: number
  name: string | null
  slug: string
  type: AttributeDataType
  unit: string | null
  isFilterable: boolean
  createdAt: string
  updatedAt: string | null
}

export interface AttributeValueType {
  id: number
  attributeId: number
  value: string
  label: string | null
  slug: string
  synonyms: string[]
  createdAt: string
  updatedAt: string | null
}

export interface AttributeWithValuesType extends AttributeType {
  values: AttributeValueType[]
}

export interface CreateAttributeData {
  slug: string
  type?: AttributeDataType
  unit?: string | null
  isFilterable?: boolean
  translations: Partial<Record<Locale, { name: string }>>
}

export interface UpdateAttributeData extends Partial<CreateAttributeData> {}

export interface CreateAttributeValueData {
  attributeId: number
  value: string
  slug: string
  synonyms?: string[]
  translations: Partial<Record<Locale, { label: string }>>
}

export interface UpdateAttributeValueData extends Partial<
  Omit<CreateAttributeValueData, 'attributeId'>
> {}
