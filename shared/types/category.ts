export interface CategoryType {
  id: number
  name: string
  slug: string
  parentId: number | null
  description: string | null
  synonyms: string[]
  createdAt: string
  updatedAt: string | null
}

export interface CreateCategoryData {
  name: string
  slug: string
  parentId?: number | null
  description?: string | null
  synonyms?: string[]
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {}
