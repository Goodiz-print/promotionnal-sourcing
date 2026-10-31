import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AttributeService from '#services/attribute_service'
import AttributeAdminTransformer from '#transformers/attribute_admin_transformer'
import AttributeEditTransformer from '#transformers/attribute_edit_transformer'
import { AttributeInUseException, AttributeNotFoundException } from '#exceptions/catalogue_errors'
import { createAttributeValidator, updateAttributeValidator } from '#validators/attribute'
import type { Locale } from '#shared/types/i18n'

/**
 * Administration des facettes du catalogue (attributs, #48). CRUD réservé à
 * l'admin plateforme (ability `canManageAttributes`). Les valeurs d'une facette
 * sont gérées par `AttributeValueController`, éditées en ligne dans `edit`.
 * Controller fin : autorisation + validation → service.
 */
@inject()
export default class AttributeController {
  constructor(private service: AttributeService) {}

  async index({ bouncer, inertia, i18n }: HttpContext) {
    await bouncer.authorize('canManageAttributes')
    const locale = i18n.locale as Locale

    const attributes = await this.service.listForAdmin()

    return inertia.render('admin/attributes/index', {
      attributes: attributes.map((attribute) =>
        new AttributeAdminTransformer(attribute, locale).toObject()
      ),
    })
  }

  async create({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('canManageAttributes')

    return inertia.render('admin/attributes/create', {})
  }

  /**
   * Crée la facette puis ouvre son écran d'édition, pour ajouter ses valeurs.
   */
  async store(ctx: HttpContext) {
    const { bouncer, request, response, i18n, session } = ctx
    await bouncer.authorize('canManageAttributes')

    const payload = await request.validateUsing(createAttributeValidator)
    const attribute = await this.service.create(payload, adminActionContext(ctx))

    session.flash('success', i18n.t('attributes.flash.created'))
    return response
      .redirect()
      .toRoute('admin.attributes.edit', { locale: i18n.locale, id: attribute.id })
  }

  async edit({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('canManageAttributes')

    const attribute = await this.service.findForEdit(Number(params.id))
    if (!attribute) throw new AttributeNotFoundException()

    return inertia.render('admin/attributes/edit', {
      attribute: new AttributeEditTransformer(attribute).toObject(),
    })
  }

  async update(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageAttributes')

    const attribute = await this.service.findById(Number(params.id))
    if (!attribute) throw new AttributeNotFoundException()

    const payload = await request.validateUsing(updateAttributeValidator)
    await this.service.update(attribute, payload, adminActionContext(ctx))

    session.flash('success', i18n.t('attributes.flash.updated'))
    return response.redirect().toRoute('admin.attributes.index', { locale: i18n.locale })
  }

  /**
   * Supprime la facette. Refusée si des produits ou des catégories l'utilisent
   * (flash d'erreur + retour arrière).
   */
  async destroy(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageAttributes')

    const attribute = await this.service.findById(Number(params.id))
    if (!attribute) throw new AttributeNotFoundException()

    try {
      await this.service.delete(attribute, adminActionContext(ctx))
    } catch (error) {
      if (!(error instanceof AttributeInUseException)) throw error
      session.flash('error', i18n.t(`attributes.flash.inUse.${error.reason}`))
      return response.redirect().back()
    }

    session.flash('success', i18n.t('attributes.flash.deleted'))
    return response.redirect().toRoute('admin.attributes.index', { locale: i18n.locale })
  }
}
