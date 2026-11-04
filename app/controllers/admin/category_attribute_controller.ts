import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import CategoryService from '#services/category_service'
import CategoryAttributeService from '#services/category_attribute_service'
import {
  CategoryNotFoundException,
  CategoryAttributeNotFoundException,
  CategoryAttributeAlreadyExistsException,
} from '#exceptions/catalogue_errors'
import {
  addCategoryAttributeValidator,
  updateCategoryAttributeValidator,
  updateCategoryAttributeRangesValidator,
} from '#validators/category_attribute'

/**
 * Gestion des attributs associés aux catégories (#165). Routes imbriquées
 * sous `admin/categories/:categoryId/attributes`. Réservé à l'admin plateforme
 * (ability `canManageCategories`). Controller fin.
 */
@inject()
export default class CategoryAttributeController {
  constructor(
    private categoryService: CategoryService,
    private service: CategoryAttributeService
  ) {}

  /**
   * Ajoute un attribut à une catégorie.
   */
  async store(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageCategories')

    const category = await this.categoryService.findById(Number(params.categoryId))
    if (!category) throw new CategoryNotFoundException()

    const payload = await request.validateUsing(addCategoryAttributeValidator)

    try {
      await this.service.add(category, payload, adminActionContext(ctx))
    } catch (error) {
      if (!(error instanceof CategoryAttributeAlreadyExistsException)) throw error
      session.flash('error', i18n.t('categories.attributes.flash.alreadyExists'))
      return response.redirect().back()
    }

    session.flash('success', i18n.t('categories.attributes.flash.added'))
    return response.redirect().back()
  }

  /**
   * Met à jour le pivot (is_required, is_filter, position).
   */
  async update(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageCategories')

    const pivot = await this.service.findById(Number(params.id))
    if (!pivot || pivot.categoryId !== Number(params.categoryId)) {
      throw new CategoryAttributeNotFoundException()
    }

    const payload = await request.validateUsing(updateCategoryAttributeValidator)
    await this.service.update(pivot, payload, adminActionContext(ctx))

    session.flash('success', i18n.t('categories.attributes.flash.updated'))
    return response.redirect().back()
  }

  /**
   * Retire un attribut d'une catégorie.
   */
  async destroy(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageCategories')

    const pivot = await this.service.findById(Number(params.id))
    if (!pivot || pivot.categoryId !== Number(params.categoryId)) {
      throw new CategoryAttributeNotFoundException()
    }

    await this.service.remove(pivot, adminActionContext(ctx))

    session.flash('success', i18n.t('categories.attributes.flash.removed'))
    return response.redirect().back()
  }

  /**
   * Met à jour les plages d'un attribut numérique.
   */
  async updateRanges(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageCategories')

    const pivot = await this.service.findById(Number(params.id))
    if (!pivot || pivot.categoryId !== Number(params.categoryId)) {
      throw new CategoryAttributeNotFoundException()
    }

    const payload = await request.validateUsing(updateCategoryAttributeRangesValidator)
    await this.service.updateRanges(pivot, payload, adminActionContext(ctx))

    session.flash('success', i18n.t('categories.attributes.flash.rangesUpdated'))
    return response.redirect().back()
  }
}
