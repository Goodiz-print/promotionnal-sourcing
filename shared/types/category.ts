import type { ContentLocale, Locale } from './i18n.js'

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
