import { inject } from '@adonisjs/core'
import Category from '#models/category'
import CategoryTranslation from '#models/category_translation'
import AttributeValue from '#models/attribute_value'
import MarkingTechnique from '#models/marking_technique'
import Supplier from '#models/supplier'
import SupplierTranslation from '#models/supplier_translation'
import ReferenceMatcher from '#shared/helpers/reference_matcher'
import { MATERIAL_ATTRIBUTE_SLUG } from '#shared/types/certification'
import type {
  ReferenceEntry,
  SupplierFeedIdentity,
  SupplierFeedLocale,
  SupplierReferences,
} from '#shared/types/supplier_feed'

/** Catégorie d'accueil des produits dont la catégorie fournisseur n'est pas reconnue. */
export const FALLBACK_CATEGORY_SLUG = 'non-classe'

/** Couleur famille (N1) et nuance (N2, rattachée à sa famille par `parentValueId`). */
const COLOR_ATTRIBUTE_SLUGS = ['color', 'color-shade']

/** `bloc-notes` → `bloc notes` : le slug est aussi un libellé rapprochable. */
function slugLabel(slug: string): string {
  return slug.replace(/-/g, ' ')
}

/**
 * Référentiels et fiche fournisseur d'un import de flux : charge catégories,
 * couleurs, matières et techniques de marquage avec leurs synonymes, et
 * garantit l'existence du fournisseur et de la catégorie de repli.
 */
@inject()
export default class SupplierReferenceService {
  async upsertSupplier(
    identity: SupplierFeedIdentity,
    locale: SupplierFeedLocale
  ): Promise<Supplier> {
    const supplier = await Supplier.updateOrCreate(
      { slug: identity.slug },
      { country: identity.country, website: identity.website, isActive: true }
    )
    await SupplierTranslation.updateOrCreate(
      { supplierId: supplier.id, locale },
      { name: identity.name }
    )
    return supplier
  }

  /**
   * Charge les référentiels. Avec `createFallback: false` (dry-run), la
   * catégorie « Non classé » est seulement cherchée, jamais créée : rien n'est
   * écrit en base, et `fallbackCategoryId` vaut 0 si elle n'existe pas encore
   * (aucune catégorie réelle n'a l'id 0).
   */
  async load({
    createFallback = true,
  }: { createFallback?: boolean } = {}): Promise<SupplierReferences> {
    const fallbackCategoryId = createFallback
      ? await this.ensureFallbackCategory()
      : await this.findFallbackCategory()

    const categories = await Category.query()
      .select('id', 'slug', 'parentId', 'synonyms')
      .preload('translations', (query) => query.select('categoryId', 'name'))
    const depth = this.depths(categories)
    const categoryEntries: ReferenceEntry[] = categories
      .filter((category) => category.id !== fallbackCategoryId)
      .map((category) => ({
        id: category.id,
        labels: [
          slugLabel(category.slug),
          ...(category.synonyms ?? []),
          ...category.translations.map((translation) => translation.name),
        ],
        // Une sous-catégorie est plus précise que sa racine.
        priority: depth.get(category.id) ?? 0,
      }))

    const values = await AttributeValue.query()
      .select('id', 'slug', 'attributeId', 'parentValueId', 'synonyms')
      .whereHas('attribute', (query) =>
        query.whereIn('slug', [...COLOR_ATTRIBUTE_SLUGS, MATERIAL_ATTRIBUTE_SLUG])
      )
      .preload('attribute', (query) => query.select('id', 'slug'))
      .preload('translations', (query) => query.select('attributeValueId', 'label'))
    const valueEntries = (attributeSlugs: string[]): ReferenceEntry[] =>
      values
        .filter((value) => attributeSlugs.includes(value.attribute.slug))
        .map((value) => ({
          id: value.id,
          labels: [
            slugLabel(value.slug),
            ...(value.synonyms ?? []),
            ...value.translations.map((translation) => translation.label),
          ],
          // Une nuance (« bleu marine ») est plus précise que sa famille.
          priority: value.parentValueId ? 1 : 0,
        }))

    const techniques = await MarkingTechnique.query()
      .select('id', 'slug', 'synonyms')
      .preload('translations', (query) => query.select('markingTechniqueId', 'name'))

    return {
      categories: new ReferenceMatcher(categoryEntries),
      colors: new ReferenceMatcher(valueEntries(COLOR_ATTRIBUTE_SLUGS)),
      materials: new ReferenceMatcher(valueEntries([MATERIAL_ATTRIBUTE_SLUG])),
      techniques: new ReferenceMatcher(
        techniques.map((technique) => ({
          id: technique.id,
          labels: [
            slugLabel(technique.slug),
            ...(technique.synonyms ?? []),
            ...technique.translations.map((translation) => translation.name),
          ],
          priority: 0,
        }))
      ),
      fallbackCategoryId,
      values: new Map(
        values.map((value) => [
          value.id,
          { attributeId: value.attributeId, parentValueId: value.parentValueId, slug: value.slug },
        ])
      ),
    }
  }

  private depths(categories: Category[]): Map<number, number> {
    const parent = new Map(categories.map((category) => [category.id, category.parentId]))
    const result = new Map<number, number>()
    for (const category of categories) {
      let depth = 0
      let current = category.parentId
      while (current !== null && current !== undefined && depth < 10) {
        depth++
        current = parent.get(current) ?? null
      }
      result.set(category.id, depth)
    }
    return result
  }

  /** Id de « Non classé » sans la créer ; 0 si elle n'existe pas encore. */
  private async findFallbackCategory(): Promise<number> {
    const category = await Category.findBy('slug', FALLBACK_CATEGORY_SLUG)
    return category?.id ?? 0
  }

  private async ensureFallbackCategory(): Promise<number> {
    const category = await Category.firstOrCreate(
      { slug: FALLBACK_CATEGORY_SLUG },
      { parentId: null, synonyms: [], position: 9999, sourceLocale: 'fr' }
    )
    await CategoryTranslation.firstOrCreate(
      { categoryId: category.id, locale: 'fr' },
      { name: 'Non classé', description: null }
    )
    return category.id
  }
}
