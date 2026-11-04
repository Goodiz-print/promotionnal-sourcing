import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import Category from '#models/category'
import CategoryAttribute from '#models/category_attribute'
import CategoryAttributeRange from '#models/category_attribute_range'
import Attribute from '#models/attribute'
import AdminAuditService from '#services/admin_audit_service'
import SearchSyncService from '#services/search_sync_service'
import {
  CategoryAttributeAlreadyExistsException,
  invalidCategoryAttributeRanges,
} from '#exceptions/catalogue_errors'
import type { AdminActionContext } from '#shared/types/admin_audit'
import type {
  AddCategoryAttributeData,
  UpdateCategoryAttributeData,
  UpdateCategoryAttributeRangesData,
} from '#shared/types/category'

/**
 * Gestion des attributs associés aux catégories (#165) : pivot
 * `category_attributes` et plages `category_attribute_ranges`.
 *
 * Un attribut peut être rattaché à n'importe quel niveau de la taxonomie.
 * `CatalogueFacetsService` résout l'ensemble en remontant la chaîne d'ancêtres.
 *
 * **Effets de bord** : modifier les facettes d'une catégorie (ajout/retrait
 * d'attribut, changement de is_filter) peut nécessiter une réindexation des
 * produits de la catégorie et de ses descendants. L'index Meilisearch contient
 * `attributeValueIds` et `attributes.<slug>` ; un changement de `is_filter`
 * modifie la liste des slugs filtrables (réglages de l'index), mais pas les
 * documents eux-mêmes. La réindexation est donc déclenchée uniquement pour
 * reconstruire les réglages au prochain `search:reindex` (pas de job immédiat).
 */
@inject()
export default class CategoryAttributeService {
  constructor(
    private audit: AdminAuditService,
    // Injection préparée pour la réindexation future si nécessaire
    _searchSync: SearchSyncService
  ) {}

  /**
   * Attributs rattachés directement à cette catégorie (pas les hérités),
   * avec leurs plages, triés par position.
   */
  async listForCategory(categoryId: number): Promise<CategoryAttribute[]> {
    return CategoryAttribute.query()
      .where('categoryId', categoryId)
      .preload('attribute', (attribute) => attribute.preload('translations'))
      .preload('ranges', (range) => range.orderBy('position', 'asc'))
      .orderBy('position', 'asc')
      .orderBy('attributeId', 'asc')
  }

  /**
   * Trouve un pivot par son ID, précharge l'attribut et les plages.
   */
  async findById(id: number): Promise<CategoryAttribute | null> {
    return CategoryAttribute.query()
      .where('id', id)
      .preload('attribute', (attribute) => attribute.preload('translations'))
      .preload('ranges', (range) => range.orderBy('position', 'asc'))
      .first()
  }

  /**
   * Trouve un pivot par catégorie et attribut.
   */
  async findByCategoryAndAttribute(
    categoryId: number,
    attributeId: number
  ): Promise<CategoryAttribute | null> {
    return CategoryAttribute.query()
      .where('categoryId', categoryId)
      .where('attributeId', attributeId)
      .first()
  }

  /**
   * Ajoute un attribut à une catégorie. Refusé si l'attribut est déjà associé.
   */
  async add(
    category: Category,
    data: AddCategoryAttributeData,
    context: AdminActionContext
  ): Promise<CategoryAttribute> {
    // Vérifier que l'attribut existe
    const attribute = await Attribute.find(data.attributeId)
    if (!attribute) {
      throw invalidCategoryAttributeRanges('Attribute not found')
    }

    // Vérifier l'unicité
    const existing = await this.findByCategoryAndAttribute(category.id, data.attributeId)
    if (existing) {
      throw new CategoryAttributeAlreadyExistsException()
    }

    // Calculer la position par défaut (après le dernier)
    const maxPosition = await CategoryAttribute.query()
      .where('categoryId', category.id)
      .max('position as max')
      .first()
    const position = data.position ?? (maxPosition?.$extras.max ?? 0) + 1

    const pivot = await db.transaction(async (trx) => {
      const created = await CategoryAttribute.create(
        {
          categoryId: category.id,
          attributeId: data.attributeId,
          isRequiredForPublication: data.isRequiredForPublication ?? false,
          isFilter: data.isFilter ?? false,
          position,
        },
        { client: trx }
      )
      await this.audit.record(
        {
          action: 'category_attribute.added',
          targetType: 'category_attribute',
          targetId: created.id,
          changes: {
            after: {
              categoryId: category.id,
              attributeId: data.attributeId,
              isFilter: created.isFilter,
            },
          },
        },
        { ...context, client: trx }
      )
      return created
    })

    // NOTE : la réindexation des produits n'est pas déclenchée ici car l'ajout
    // d'un attribut à une catégorie ne change pas les valeurs d'attributs des
    // produits existants. Les réglages de l'index (filterable slugs) seront mis
    // à jour au prochain search:reindex.

    return pivot
  }

  /**
   * Met à jour le pivot (is_required, is_filter, position).
   */
  async update(
    pivot: CategoryAttribute,
    data: UpdateCategoryAttributeData,
    context: AdminActionContext
  ): Promise<CategoryAttribute> {
    const snapshot = (source: CategoryAttribute) => ({
      isRequiredForPublication: source.isRequiredForPublication,
      isFilter: source.isFilter,
      position: source.position,
    })
    const before = snapshot(pivot)

    await db.transaction(async (trx) => {
      pivot.useTransaction(trx)
      if (data.isRequiredForPublication !== undefined) {
        pivot.isRequiredForPublication = data.isRequiredForPublication
      }
      if (data.isFilter !== undefined) pivot.isFilter = data.isFilter
      if (data.position !== undefined) pivot.position = data.position
      await pivot.save()

      await this.audit.record(
        {
          action: 'category_attribute.updated',
          targetType: 'category_attribute',
          targetId: pivot.id,
          changes: { before, after: snapshot(pivot) },
        },
        { ...context, client: trx }
      )
    })

    return pivot
  }

  /**
   * Retire un attribut d'une catégorie (supprime le pivot et ses plages).
   */
  async remove(pivot: CategoryAttribute, context: AdminActionContext): Promise<void> {
    await db.transaction(async (trx) => {
      // Les plages sont supprimées par cascade (FK)
      await pivot.useTransaction(trx).delete()
      await this.audit.record(
        {
          action: 'category_attribute.removed',
          targetType: 'category_attribute',
          targetId: pivot.id,
          changes: {
            before: {
              categoryId: pivot.categoryId,
              attributeId: pivot.attributeId,
            },
          },
        },
        { ...context, client: trx }
      )
    })
  }

  /**
   * Met à jour les plages d'un attribut numérique sur une catégorie.
   * Remplace les plages existantes (synchronisation complète).
   * Validation : l'attribut doit être de type `number`, et min < max.
   */
  async updateRanges(
    pivot: CategoryAttribute,
    data: UpdateCategoryAttributeRangesData,
    context: AdminActionContext
  ): Promise<CategoryAttribute> {
    // Charger l'attribut pour vérifier le type
    await pivot.load('attribute')
    if (pivot.attribute.type !== 'number') {
      throw invalidCategoryAttributeRanges('Ranges can only be set on numeric attributes')
    }

    // Valider les plages
    for (const range of data.ranges) {
      if (
        range.minValue !== null &&
        range.minValue !== undefined &&
        range.maxValue !== null &&
        range.maxValue !== undefined &&
        range.minValue >= range.maxValue
      ) {
        throw invalidCategoryAttributeRanges('minValue must be less than maxValue')
      }
    }

    await db.transaction(async (trx) => {
      // Supprimer les plages existantes
      await CategoryAttributeRange.query({ client: trx })
        .where('categoryAttributeId', pivot.id)
        .delete()

      // Créer les nouvelles plages
      for (let i = 0; i < data.ranges.length; i++) {
        const range = data.ranges[i]
        await CategoryAttributeRange.create(
          {
            categoryAttributeId: pivot.id,
            // Les décimaux sont stockés comme chaînes dans Lucid
            minValue:
              range.minValue === null || range.minValue === undefined
                ? null
                : String(range.minValue),
            maxValue:
              range.maxValue === null || range.maxValue === undefined
                ? null
                : String(range.maxValue),
            position: i,
          },
          { client: trx }
        )
      }

      await this.audit.record(
        {
          action: 'category_attribute.updated',
          targetType: 'category_attribute',
          targetId: pivot.id,
          changes: {
            after: { rangesCount: data.ranges.length },
          },
        },
        { ...context, client: trx }
      )
    })

    // Recharger les plages
    await pivot.load('ranges', (query) => query.orderBy('position', 'asc'))
    return pivot
  }

  /**
   * IDs des produits dans une catégorie et ses descendants.
   * Utilisé pour déclencher une réindexation si nécessaire.
   */
  async productIdsInCategoryTree(categoryId: number): Promise<number[]> {
    // Récupérer tous les descendants
    const descendantIds = await this.descendantCategoryIds(categoryId)
    const categoryIds = [categoryId, ...descendantIds]

    const rows = await db.from('products').whereIn('category_id', categoryIds).select('id')
    return rows.map((row) => row.id)
  }

  /**
   * IDs de tous les descendants d'une catégorie.
   */
  private async descendantCategoryIds(rootId: number): Promise<number[]> {
    const all = await Category.query().select('id', 'parentId')
    const childrenByParent = new Map<number, number[]>()
    for (const category of all) {
      if (category.parentId === null) continue
      const siblings = childrenByParent.get(category.parentId) ?? []
      siblings.push(category.id)
      childrenByParent.set(category.parentId, siblings)
    }

    const result: number[] = []
    const stack = [rootId]
    while (stack.length > 0) {
      const current = stack.pop()!
      for (const child of childrenByParent.get(current) ?? []) {
        if (!result.includes(child)) {
          result.push(child)
          stack.push(child)
        }
      }
    }
    return result
  }
}
