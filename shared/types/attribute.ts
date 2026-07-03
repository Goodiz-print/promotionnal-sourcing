/**
 * Nature de la donnee portee par un attribut (facette).
 * `enum` : valeurs enumerees (couleur, matiere) ; `number` : mesure libre
 * (grammage) ; `string`/`boolean` : cas simples.
 */
export type AttributeDataType = 'string' | 'number' | 'boolean' | 'enum'

export interface AttributeType {
  id: number
  name: string
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
  label: string
  slug: string
  synonyms: string[]
  createdAt: string
  updatedAt: string | null
}

export interface AttributeWithValuesType extends AttributeType {
  values: AttributeValueType[]
}

export interface CreateAttributeData {
  name: string
  slug: string
  type?: AttributeDataType
  unit?: string | null
  isFilterable?: boolean
}

export interface UpdateAttributeData extends Partial<CreateAttributeData> {}

export interface CreateAttributeValueData {
  attributeId: number
  value: string
  label: string
  slug: string
  synonyms?: string[]
}

export interface UpdateAttributeValueData extends Partial<
  Omit<CreateAttributeValueData, 'attributeId'>
> {}
