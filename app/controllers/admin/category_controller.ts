import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import CategoryService from '#services/category_service'
import CategoryAttributeService from '#services/category_attribute_service'
import CategoryAdminTransformer from '#transformers/category_admin_transformer'
import CategoryEditTransformer from '#transformers/category_edit_transformer'
import CategoryTransformer from '#transformers/category_transformer'
import CategoryAttributeEditTransformer from '#transformers/category_attribute_edit_transformer'
import { CategoryNotFoundException } from '#exceptions/catalogue_errors'
import {
  createCategoryValidator,
  moveCategoryValidator,
  updateCategoryValidator,
} from '#validators/category'
import type { Locale } from '#shared/types/i18n'

/**
 * Administration de la taxonomie du catalogue (catégories globales). CRUD
 * complet réservé au rôle plateforme qui porte `catalogue.manage` (ability
 * `canManageCategories`) ; chaque écriture est inscrite au journal d'audit. Controller
 * fin : org + autorisation + validation → service.
 */
@inject()
export default class CategoryController {
  constructor(
    private service: CategoryService,
    private attributeService: CategoryAttributeService
  ) {}

  /**
   * Liste des catégories (avec parent et nombre de produits).
   */
  async index({ bouncer, inertia, i18n }: HttpContext) {
    await bouncer.authorize('canManageCategories')
    const locale = i18n.locale as Locale

    const categories = await this.service.listForAdmin()

    return inertia.render('admin/categories/index', {
      categories: categories.map((category) =>
        new CategoryAdminTransformer(category, locale).toObject()
      ),
    })
  }

  /**
   * Formulaire de création (liste des parents assignables).
   */
  async create({ bouncer, inertia, i18n }: HttpContext) {
    await bouncer.authorize('canManageCategories')

    return inertia.render('admin/categories/create', {
      parents: await this.parentOptions(i18n.locale as Locale),
    })
  }

  /**
   * Crée la catégorie puis redirige vers la liste.
   */
  async store(ctx: HttpContext) {
    const { bouncer, request, response, i18n, session } = ctx
    await bouncer.authorize('canManageCategories')

    const payload = await request.validateUsing(createCategoryValidator)
    await this.service.create(payload, adminActionContext(ctx))

    session.flash('success', i18n.t('categories.flash.created'))
    return response.redirect().toRoute('admin.categories.index', { locale: i18n.locale })
  }

  /**
   * Formulaire d'edition (parents assignables = tous sauf la categorie et ses
   * descendants, pour eviter les cycles ; attributs associes et disponibles).
   */
  async edit({ bouncer, inertia, params, i18n }: HttpContext) {
    await bouncer.authorize('canManageCategories')
    const locale = i18n.locale as Locale

    const category = await this.service.findById(Number(params.id))
    if (!category) throw new CategoryNotFoundException()

    const categoryAttributes = await this.attributeService.listForCategory(category.id)
    const availableAttributes = await this.attributeService.availableForCategory(
      category.id,
      locale
    )

    return inertia.render('admin/categories/edit', {
      category: new CategoryEditTransformer(category).toObject(),
      parents: await this.parentOptions(locale, category.id),
      categoryAttributes: categoryAttributes.map((pivot) =>
        new CategoryAttributeEditTransformer(pivot, locale).toObject()
      ),
      availableAttributes,
    })
  }

  /**
   * Met à jour la catégorie. Garde-fou anti-cycle (défense en profondeur : le
   * formulaire exclut déjà les descendants).
   */
  async update(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageCategories')

    const category = await this.service.findById(Number(params.id))
    if (!category) throw new CategoryNotFoundException()

    const payload = await request.validateUsing(updateCategoryValidator)

    if (await this.service.wouldCycle(category, payload.parentId)) {
      session.flash('error', i18n.t('categories.flash.cycle'))
      return response.redirect().back()
    }

    await this.service.update(category, payload, adminActionContext(ctx))

    session.flash('success', i18n.t('categories.flash.updated'))
    return response.redirect().toRoute('admin.categories.index', { locale: i18n.locale })
  }

  /**
   * Complète les traductions manquantes de toutes les catégories (mise en file
   * de la traduction automatique ; les noms saisis ne sont jamais écrasés).
   */
  async translate({ bouncer, response, session, i18n }: HttpContext) {
    await bouncer.authorize('canManageCategories')

    const { queued, failed } = await this.service.requestMissingTranslations()

    if (failed) session.flash('error', i18n.t('categories.flash.translationsFailed'))
    else session.flash('success', i18n.t('categories.flash.translationsQueued', { count: queued }))
    return response.redirect().back()
  }

  /**
   * Déplace la catégorie d'un cran parmi ses sœurs. Sans effet (ni audit) si
   * elle est déjà en bout de liste.
   */
  async move(ctx: HttpContext) {
    const { bouncer, request, response, params, session } = ctx
    await bouncer.authorize('canManageCategories')

    const category = await this.service.findById(Number(params.id))
    if (!category) throw new CategoryNotFoundException()

    const { direction } = await request.validateUsing(moveCategoryValidator)
    const moved = await this.service.move(category, direction, adminActionContext(ctx))

    // Déjà en bout de liste : rien n'a changé, on n'annonce pas de succès.
    if (moved) session.flash('success', ctx.i18n.t('categories.flash.moved'))
    return response.redirect().back()
  }

  /**
   * Supprime la catégorie. Bloquée si elle porte des sous-catégories ou des
   * produits (flash d'erreur + retour arrière).
   */
  async destroy(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageCategories')

    const category = await this.service.findById(Number(params.id))
    if (!category) throw new CategoryNotFoundException()

    if (await this.service.hasChildren(category)) {
      session.flash('error', i18n.t('categories.flash.hasChildren'))
      return response.redirect().back()
    }
    if (await this.service.hasProducts(category)) {
      session.flash('error', i18n.t('categories.flash.hasProducts'))
      return response.redirect().back()
    }

    await this.service.delete(category, adminActionContext(ctx))

    session.flash('success', i18n.t('categories.flash.deleted'))
    return response.redirect().toRoute('admin.categories.index', { locale: i18n.locale })
  }

  /**
   * Parents assignables sérialisés (localisés). `excludeId` retire la catégorie
   * courante et ses descendants.
   */
  private async parentOptions(locale: Locale, excludeId?: number) {
    const parents = await this.service.assignableParents(excludeId)
    return parents.map((category) => new CategoryTransformer(category, locale).toObject())
  }
}
