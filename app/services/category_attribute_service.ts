import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import CategoryAttribute from '#models/category_attribute'
import CategoryAttributeRange from '#models/category_attribute_range'
import Attribute from '#models/attribute'
import AdminAuditService from '#services/admin_audit_service'
import SearchSyncService from '#services/search_sync_service'
import {
  AttributeNotFoundException,
  CategoryAttributeAlreadyExistsException,
  invalidCategoryAttributeRanges,
} from '#exceptions/catalogue_errors'
import type { AdminActionContext } from '#shared/types/admin_audit'
import Category from '#models/category'
import { resolveTranslation } from '#shared/helpers/translations'
import type { Locale } from '#shared/types/i18n'
import type {
  AddCategoryAttributeData,
  CategoryAttributeOption,
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
   * Attributs NON encore associes a cette categorie, pour le selecteur d'ajout.
   * Renvoie `{ id, slug, name }` avec `name` resolu dans la locale active.
   */
  async availableForCategory(
    categoryId: number,
    locale: Locale
  ): Promise<CategoryAttributeOption[]> {
    // IDs des attributs deja associes
    const existing = await CategoryAttribute.query()
      .where('categoryId', categoryId)
      .select('attributeId')
    const excludedIds = existing.map((pivot) => pivot.attributeId)

    // Tous les attributs sauf ceux deja associes
    const query = Attribute.query().preload('translations').orderBy('slug')
    if (excludedIds.length > 0) {
      query.whereNotIn('id', excludedIds)
    }
    const attributes = await query

    return attributes.map((attribute) => {
      const translation = resolveTranslation(attribute.translations, locale, {
        sourceLocale: attribute.sourceLocale,
      })
      return {
        id: attribute.id,
        slug: attribute.slug,
        name: translation?.name ?? null,
      }
    })
  }

  /**
   * Ajoute un attribut a une categorie. Refuse si l'attribut est deja associe.
   * Declenche un rafraichissement des reglages si `isFilter` est `true`.
   *
   * La verification d'unicite et l'insertion sont faites dans la meme transaction
   * avec verrou sur la categorie pour eviter les courses (deux requetes simultanees).
   * Le code d'erreur Postgres 23505 (violation d'unicite) est intercepte et converti
   * en `CategoryAttributeAlreadyExistsException`.
   */
  async add(
    category: Category,
    data: AddCategoryAttributeData,
    context: AdminActionContext
  ): Promise<CategoryAttribute> {
    // Verifier que l'attribut existe (hors transaction, lecture seule)
    const attribute = await Attribute.find(data.attributeId)
    if (!attribute) {
      throw new AttributeNotFoundException()
    }

    const isFilter = data.isFilter ?? false

    try {
      const pivot = await db.transaction(async (trx) => {
        // Verrou sur la categorie pour serialiser les ajouts concurrents
        await Category.query({ client: trx }).where('id', category.id).forUpdate().firstOrFail()

        // Verifier l'unicite dans la transaction
        const existing = await CategoryAttribute.query({ client: trx })
          .where('categoryId', category.id)
          .where('attributeId', data.attributeId)
          .first()
        if (existing) {
          throw new CategoryAttributeAlreadyExistsException()
        }

        // Calculer la position par defaut (apres le dernier)
        const maxPosition = await CategoryAttribute.query({ client: trx })
          .where('categoryId', category.id)
          .max('position as max')
          .first()
        const position = data.position ?? (maxPosition?.$extras.max ?? 0) + 1

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
    } catch (error) {
      // Intercepter l'erreur Postgres de violation d'unicite (code 23505)
      if (this.isUniqueViolation(error)) {
        throw new CategoryAttributeAlreadyExistsException()
      }
      throw error
    }
  }

  /**
   * Detecte une violation d'unicite Postgres (code 23505).
   */
  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    )
  }

  /**
   * Met a jour le pivot (is_required, is_filter, position).
   * Declenche un rafraichissement des reglages si `is_filter` change.
   *
   * **Regle no-op** (docs/admin.md) : si rien ne change, aucune trace d'audit.
   */
  async update(
    pivot: CategoryAttribute,
    data: UpdateCategoryAttributeData,
    context: AdminActionContext
  ): Promise<{ pivot: CategoryAttribute; changed: boolean }> {
    const snapshot = (source: CategoryAttribute) => ({
      isRequiredForPublication: source.isRequiredForPublication,
      isFilter: source.isFilter,
      position: source.position,
    })
    const before = snapshot(pivot)
    const wasFilter = pivot.isFilter

    // Detecter les changements
    const newIsRequired =
      data.isRequiredForPublication !== undefined
        ? data.isRequiredForPublication
        : pivot.isRequiredForPublication
    const newIsFilter = data.isFilter !== undefined ? data.isFilter : pivot.isFilter
    const newPosition = data.position !== undefined ? data.position : pivot.position

    const wouldChange =
      before.isRequiredForPublication !== newIsRequired ||
      before.isFilter !== newIsFilter ||
      before.position !== newPosition

    // Aucun changement : retour sans ecriture ni audit
    if (!wouldChange) {
      return { pivot, changed: false }
    }

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

    return { pivot, changed: true }
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
   * Validation : l'attribut doit etre de type `number`, min < max, et les
   * plages ne doivent pas se chevaucher.
   *
   * Les plages servent au calcul des facettes a la requete (filtres numeriques
   * par tranche) ; elles n'alimentent pas les reglages de l'index, donc pas
   * de rafraichissement necessaire.
   *
   * **Regle no-op** (docs/admin.md) : si les plages sont identiques, aucune
   * trace d'audit.
   */
  async updateRanges(
    pivot: CategoryAttribute,
    data: UpdateCategoryAttributeRangesData,
    context: AdminActionContext
  ): Promise<{ pivot: CategoryAttribute; changed: boolean }> {
    // Charger l'attribut pour verifier le type
    await pivot.load('attribute')
    if (pivot.attribute.type !== 'number') {
      throw invalidCategoryAttributeRanges('Ranges can only be set on numeric attributes')
    }

    // Valider les plages individuellement
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

    // Valider l'absence de chevauchement entre plages
    this.validateNoOverlap(data.ranges)

    // Charger les plages existantes pour detecter le no-op
    await pivot.load('ranges', (query) => query.orderBy('position', 'asc'))
    const existingNormalized = this.normalizeRanges(pivot.ranges)
    const newNormalized = this.normalizeRangesInput(data.ranges)

    // Aucun changement : retour sans ecriture ni audit
    if (existingNormalized === newNormalized) {
      return { pivot, changed: false }
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
    return { pivot, changed: true }
  }

  /**
   * Normalise les plages existantes pour comparaison (bornes ouvertes = null).
   * Renvoie une chaine JSON triee representant les plages.
   */
  private normalizeRanges(ranges: CategoryAttributeRange[]): string {
    const normalized = ranges
      .map((r) => ({
        min: r.minValue !== null ? Number(r.minValue) : null,
        max: r.maxValue !== null ? Number(r.maxValue) : null,
      }))
      .sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity))
    return JSON.stringify(normalized)
  }

  /**
   * Normalise les plages de l'input pour comparaison.
   */
  private normalizeRangesInput(ranges: UpdateCategoryAttributeRangesData['ranges']): string {
    const normalized = ranges
      .map((r) => ({
        min: r.minValue !== null && r.minValue !== undefined ? r.minValue : null,
        max: r.maxValue !== null && r.maxValue !== undefined ? r.maxValue : null,
      }))
      .sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity))
    return JSON.stringify(normalized)
  }

  /**
   * Valide que les plages ne se chevauchent pas. Une borne ouverte (null) est
   * traitee comme -Infinity (min) ou +Infinity (max). Deux plages se chevauchent
   * si leurs intervalles (min, max] et (min', max'] ont une intersection non vide.
   */
  private validateNoOverlap(ranges: UpdateCategoryAttributeRangesData['ranges']): void {
    if (ranges.length < 2) return

    // Normaliser les bornes pour la comparaison
    const intervals = ranges.map((r) => ({
      min: r.minValue !== null && r.minValue !== undefined ? r.minValue : -Infinity,
      max: r.maxValue !== null && r.maxValue !== undefined ? r.maxValue : Infinity,
    }))

    // Trier par borne inferieure
    intervals.sort((a, b) => a.min - b.min)

    // Verifier le chevauchement entre plages consecutives
    for (let i = 0; i < intervals.length - 1; i++) {
      const current = intervals[i]
      const next = intervals[i + 1]
      // Chevauchement si la borne superieure de l'intervalle courant > borne inferieure du suivant
      if (current.max > next.min) {
        throw invalidCategoryAttributeRanges(
          'Ranges must not overlap: check that intervals do not share values'
        )
      }
    }
  }
}
