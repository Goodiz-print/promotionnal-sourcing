import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
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
import type Category from '#models/category'
import type {
  AddCategoryAttributeData,
  UpdateCategoryAttributeData,
  UpdateCategoryAttributeRangesData,
} from '#shared/types/category'

/**
 * Gestion des attributs associes aux categories (#165) : pivot
 * `category_attributes` et plages `category_attribute_ranges`.
 *
 * Un attribut peut etre rattache a n'importe quel niveau de la taxonomie.
 * `CatalogueFacetsService` resout l'ensemble en remontant la chaine d'ancetres.
 *
 * **Effets de bord** : modifier `is_filter` d'un pivot declenche un
 * rafraichissement des reglages de l'index Meilisearch (liste des
 * `attributes.<slug>` filtrables) via `SearchSyncService.queueSettings()`.
 * Les documents de l'index ne changent pas (ils contiennent deja toutes les
 * valeurs d'attributs) ; seuls les reglages sont mis a jour.
 */
@inject()
export default class CategoryAttributeService {
  constructor(
    private audit: AdminAuditService,
    private searchSync: SearchSyncService
  ) {}

  /**
   * Attributs rattaches directement a cette categorie (pas les herites),
   * avec leurs plages, tries par position.
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
   * Trouve un pivot par son ID, precharge l'attribut et les plages.
   */
  async findById(id: number): Promise<CategoryAttribute | null> {
    return CategoryAttribute.query()
      .where('id', id)
      .preload('attribute', (attribute) => attribute.preload('translations'))
      .preload('ranges', (range) => range.orderBy('position', 'asc'))
      .first()
  }

  /**
   * Trouve un pivot par categorie et attribut.
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
   * Ajoute un attribut a une categorie. Refuse si l'attribut est deja associe.
   * Declenche un rafraichissement des reglages si `isFilter` est `true`.
   */
  async add(
    category: Category,
    data: AddCategoryAttributeData,
    context: AdminActionContext
  ): Promise<CategoryAttribute> {
    // Verifier que l'attribut existe
    const attribute = await Attribute.find(data.attributeId)
    if (!attribute) {
      throw invalidCategoryAttributeRanges('Attribute not found')
    }

    // Verifier l'unicite
    const existing = await this.findByCategoryAndAttribute(category.id, data.attributeId)
    if (existing) {
      throw new CategoryAttributeAlreadyExistsException()
    }

    // Calculer la position par defaut (apres le dernier)
    const maxPosition = await CategoryAttribute.query()
      .where('categoryId', category.id)
      .max('position as max')
      .first()
    const position = data.position ?? (maxPosition?.$extras.max ?? 0) + 1

    const isFilter = data.isFilter ?? false

    const pivot = await db.transaction(async (trx) => {
      const created = await CategoryAttribute.create(
        {
          categoryId: category.id,
          attributeId: data.attributeId,
          isRequiredForPublication: data.isRequiredForPublication ?? false,
          isFilter,
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

      // Si isFilter est true, rafraichir les reglages apres commit
      if (isFilter) {
        trx.after('commit', () => this.searchSync.queueSettings())
      }

      return created
    })

    return pivot
  }

  /**
   * Met a jour le pivot (is_required, is_filter, position).
   * Declenche un rafraichissement des reglages si `is_filter` change.
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
    const wasFilter = pivot.isFilter

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

      // Si is_filter a change, rafraichir les reglages apres commit
      if (wasFilter !== pivot.isFilter) {
        trx.after('commit', () => this.searchSync.queueSettings())
      }
    })

    return pivot
  }

  /**
   * Retire un attribut d'une categorie (supprime le pivot et ses plages).
   * Declenche un rafraichissement des reglages si le pivot etait filtrable.
   */
  async remove(pivot: CategoryAttribute, context: AdminActionContext): Promise<void> {
    const wasFilter = pivot.isFilter

    await db.transaction(async (trx) => {
      // Les plages sont supprimees par cascade (FK)
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
              isFilter: pivot.isFilter,
            },
          },
        },
        { ...context, client: trx }
      )

      // Si le pivot etait filtrable, rafraichir les reglages apres commit
      if (wasFilter) {
        trx.after('commit', () => this.searchSync.queueSettings())
      }
    })
  }

  /**
   * Met a jour les plages d'un attribut numerique sur une categorie.
   * Remplace les plages existantes (synchronisation complete).
   * Validation : l'attribut doit etre de type `number`, et min < max.
   *
   * Les plages servent au calcul des facettes a la requete (filtres numeriques
   * par tranche) ; elles n'alimentent pas les reglages de l'index, donc pas
   * de rafraichissement necessaire.
   */
  async updateRanges(
    pivot: CategoryAttribute,
    data: UpdateCategoryAttributeRangesData,
    context: AdminActionContext
  ): Promise<CategoryAttribute> {
    // Charger l'attribut pour verifier le type
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

      // Creer les nouvelles plages
      for (let i = 0; i < data.ranges.length; i++) {
        const range = data.ranges[i]
        await CategoryAttributeRange.create(
          {
            categoryAttributeId: pivot.id,
            // Les decimaux sont stockes comme chaines dans Lucid
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
}
