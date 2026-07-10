import type { Locale } from './i18n.js'

export interface CategoryTranslationType {
  locale: Locale
  name: string
  description: string | null
}

export interface CategoryType {
  id: number
  name: string | null
  slug: string
  parentId: number | null
  description: string | null
  synonyms: string[]
  createdAt: string
  updatedAt: string | null
}

export interface CreateCategoryData {
  slug: string
  parentId?: number | null
  synonyms?: string[]
  translations: Partial<Record<Locale, { name: string; description?: string | null }>>
}

export interface UpdateCategoryData extends Partial<CreateCategoryData> {}
