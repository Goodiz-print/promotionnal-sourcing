import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import CategoryService from '#services/category_service'
import CategoryAdminTransformer from '#transformers/category_admin_transformer'
import CategoryEditTransformer from '#transformers/category_edit_transformer'
import CategoryTransformer from '#transformers/category_transformer'
import { CategoryNotFoundException } from '#exceptions/catalogue_errors'
import { createCategoryValidator, updateCategoryValidator } from '#validators/category'
import type { Locale } from '#shared/types/i18n'

/**
 * Administration de la taxonomie du catalogue (catégories globales). CRUD
 * complet réservé aux owner/admin (ability `canManageCategories`). Controller
 * fin : org + autorisation + validation → service.
 */
@inject()
export default class CategoryController {
  constructor(private service: CategoryService) {}

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
  async store({ bouncer, request, response, i18n, session }: HttpContext) {
    await bouncer.authorize('canManageCategories')

    const payload = await request.validateUsing(createCategoryValidator)
    await this.service.create(payload)

    session.flash('success', i18n.t('categories.flash.created'))
    return response.redirect().toRoute('admin.categories.index', { locale: i18n.locale })
  }

  /**
   * Formulaire d'édition (parents assignables = tous sauf la catégorie et ses
   * descendants, pour éviter les cycles).
   */
  async edit({ bouncer, inertia, params, i18n }: HttpContext) {
    await bouncer.authorize('canManageCategories')

    const category = await this.service.findById(Number(params.id))
    if (!category) throw new CategoryNotFoundException()

    return inertia.render('admin/categories/edit', {
      category: new CategoryEditTransformer(category).toObject(),
      parents: await this.parentOptions(i18n.locale as Locale, category.id),
    })
  }

  /**
   * Met à jour la catégorie. Garde-fou anti-cycle (défense en profondeur : le
   * formulaire exclut déjà les descendants).
   */
  async update({ bouncer, request, response, params, i18n, session }: HttpContext) {
    await bouncer.authorize('canManageCategories')

    const category = await this.service.findById(Number(params.id))
    if (!category) throw new CategoryNotFoundException()

    const payload = await request.validateUsing(updateCategoryValidator)

    if (await this.service.wouldCycle(category, payload.parentId)) {
      session.flash('error', i18n.t('categories.flash.cycle'))
      return response.redirect().back()
    }

    await this.service.update(category, payload)

    session.flash('success', i18n.t('categories.flash.updated'))
    return response.redirect().toRoute('admin.categories.index', { locale: i18n.locale })
  }

  /**
   * Supprime la catégorie. Bloquée si elle porte des sous-catégories ou des
   * produits (flash d'erreur + retour arrière).
   */
  async destroy({ bouncer, response, params, i18n, session }: HttpContext) {
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

    await this.service.delete(category)

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
