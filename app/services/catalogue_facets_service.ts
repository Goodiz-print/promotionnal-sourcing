import { inject } from '@adonisjs/core'
import Category from '#models/category'
import CategoryAttribute from '#models/category_attribute'
import AttributeValueTransformer from '#transformers/attribute_value_transformer'
import { resolveTranslation } from '#shared/helpers/translations'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import type { AttributeDataType } from '#shared/types/attribute'
import type { CategoryAttributeType } from '#shared/types/category'
import { ProductPublicationBlockedException } from '#exceptions/catalogue_errors'

/**
 * Résolution des facettes d'une catégorie (écarts 1 et 6 du plan d'extension).
 *
 * Un attribut peut être rattaché à **n'importe quel niveau** de la taxonomie
 * (N1, N2 ou N3). L'ensemble pertinent d'une catégorie est donc la réunion de
 * ses attributs propres **et de tous ceux de ses ancêtres** — on remonte
 * `parent_id` jusqu'à la racine. Un attribut rattaché à plusieurs niveaux n'est
 * gardé qu'une fois (le niveau le plus proche de la catégorie l'emporte : il
 * porte l'ordre et les règles les plus spécifiques).
 *
 * L'ordre de sortie est `position` croissant (le `position` du pivot), départagé
 * par `attributeId` : stable d'un appel à l'autre.
 */
@inject()
export default class CatalogueFacetsService {
  /**
   * Attributs résolus d'une catégorie (propres + hérités des ancêtres), triés.
   * `locale` localise les noms d'attributs et libellés de valeurs.
   */
  async resolveForCategory(
    categoryId: number,
    locale: Locale = DEFAULT_LOCALE
  ): Promise<CategoryAttributeType[]> {
    const chain = await this.ancestorChain(categoryId)
    if (chain.length === 0) return []

    const rows = await CategoryAttribute.query()
      .whereIn('categoryId', chain)
      .preload('attribute', (attribute) =>
        attribute
          .preload('translations')
          .preload('values', (value) => value.preload('translations'))
      )
      .preload('ranges', (range) => range.orderBy('position', 'asc'))

    // Distance à la catégorie demandée : plus l'ancêtre est proche, plus il est
    // prioritaire en cas de rattachement du même attribut à plusieurs niveaux.
    const depthById = new Map(chain.map((id, depth) => [id, depth]))
    const byAttribute = new Map<number, { row: CategoryAttribute; depth: number }>()
    for (const row of rows) {
      const depth = depthById.get(row.categoryId) ?? Number.MAX_SAFE_INTEGER
      const existing = byAttribute.get(row.attributeId)
      if (!existing || depth < existing.depth) byAttribute.set(row.attributeId, { row, depth })
    }

    return [...byAttribute.values()]
      .map(({ row }) => this.toFacet(row, locale))
      .sort((a, b) => a.position - b.position || a.attributeId - b.attributeId)
  }

  /** Sous-ensemble filtrable (barre de filtres) : `is_filter = true`. */
  async resolveFilters(
    categoryId: number,
    locale: Locale = DEFAULT_LOCALE
  ): Promise<CategoryAttributeType[]> {
    const facets = await this.resolveForCategory(categoryId, locale)
    return facets.filter((facet) => facet.isFilter)
  }

  /**
   * Attributs manquants (slugs) pour publier une fiche de cette catégorie :
   * ceux marqués `is_required_for_publication` (catégorie + ancêtres) dont
   * aucun `attribute_id` n'est présent dans `presentAttributeIds` (les attributs
   * réellement renseignés sur le produit).
   */
  async missingRequiredAttributes(
    categoryId: number,
    presentAttributeIds: Iterable<number>
  ): Promise<string[]> {
    const present = new Set(presentAttributeIds)
    const facets = await this.resolveForCategory(categoryId)
    return facets
      .filter((facet) => facet.isRequiredForPublication && !present.has(facet.attributeId))
      .map((facet) => facet.slug)
  }

  /**
   * Garde de publication : lève `ProductPublicationBlockedException` si un
   * attribut obligatoire de la catégorie (ou d'un ancêtre) n'est pas renseigné.
   */
  async assertPublishable(
    categoryId: number,
    presentAttributeIds: Iterable<number>
  ): Promise<void> {
    const missing = await this.missingRequiredAttributes(categoryId, presentAttributeIds)
    if (missing.length > 0) throw new ProductPublicationBlockedException(missing)
  }

  /**
   * Chaîne d'identifiants [catégorie, parent, …, racine]. Les catégories sont
   * peu nombreuses et l'arbre peu profond (≤ 3) : on remonte par petites
   * requêtes plutôt que par un CTE récursif, pour rester portable.
   */
  private async ancestorChain(categoryId: number): Promise<number[]> {
    const chain: number[] = []
    const seen = new Set<number>()
    let current: number | null = categoryId
    while (current !== null && !seen.has(current)) {
      const category = await Category.query().where('id', current).select('id', 'parentId').first()
      if (!category) break
      chain.push(category.id)
      seen.add(category.id)
      current = category.parentId
    }
    return chain
  }

  private toFacet(row: CategoryAttribute, locale: Locale): CategoryAttributeType {
    const attribute = row.attribute
    const name = resolveTranslation(attribute.translations, locale)?.name ?? null

    return {
      attributeId: attribute.id,
      slug: attribute.slug,
      name,
      type: attribute.type as AttributeDataType,
      unit: attribute.unit,
      isRequiredForPublication: row.isRequiredForPublication,
      isFilter: row.isFilter,
      position: row.position,
      categoryId: row.categoryId,
      values: attribute.values.map((value) =>
        new AttributeValueTransformer(value, locale).toObject()
      ),
      ranges: row.ranges.map((range) => ({
        minValue: range.minValue === null ? null : Number(range.minValue),
        maxValue: range.maxValue === null ? null : Number(range.maxValue),
      })),
    }
  }
}
