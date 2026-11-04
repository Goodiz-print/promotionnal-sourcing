import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import MarkingTechniqueService from '#services/marking_technique_service'
import MarkingTechniqueAdminTransformer from '#transformers/marking_technique_admin_transformer'
import MarkingTechniqueEditTransformer from '#transformers/marking_technique_edit_transformer'
import {
  MarkingTechniqueNotFoundException,
  MarkingTechniqueInUseException,
} from '#exceptions/catalogue_errors'
import {
  createMarkingTechniqueValidator,
  updateMarkingTechniqueValidator,
} from '#validators/marking_technique'
import type { Locale } from '#shared/types/i18n'

/**
 * Administration des techniques de marquage (#165). CRUD réservé à l'admin
 * plateforme (ability `canManageMarkingTechniques`). Controller fin :
 * autorisation + validation -> service.
 */
@inject()
export default class MarkingTechniqueController {
  constructor(private service: MarkingTechniqueService) {}

  async index({ bouncer, inertia, i18n }: HttpContext) {
    await bouncer.authorize('canManageMarkingTechniques')
    const locale = i18n.locale as Locale

    const techniques = await this.service.listForAdmin()

    return inertia.render('admin/marking_techniques/index', {
      techniques: techniques.map((technique) =>
        new MarkingTechniqueAdminTransformer(technique, locale).toObject()
      ),
    })
  }

  async create({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('canManageMarkingTechniques')

    return inertia.render('admin/marking_techniques/create', {})
  }

  /**
   * Crée la technique puis ouvre son écran d'édition.
   */
  async store(ctx: HttpContext) {
    const { bouncer, request, response, i18n, session } = ctx
    await bouncer.authorize('canManageMarkingTechniques')

    const payload = await request.validateUsing(createMarkingTechniqueValidator)
    const technique = await this.service.create(payload, adminActionContext(ctx))

    session.flash('success', i18n.t('markingTechniques.flash.created'))
    return response
      .redirect()
      .toRoute('admin.marking_techniques.edit', { locale: i18n.locale, id: technique.id })
  }

  async edit({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('canManageMarkingTechniques')

    const technique = await this.service.findForEdit(Number(params.id))
    if (!technique) throw new MarkingTechniqueNotFoundException()

    return inertia.render('admin/marking_techniques/edit', {
      technique: new MarkingTechniqueEditTransformer(technique).toObject(),
    })
  }

  async update(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageMarkingTechniques')

    const technique = await this.service.findById(Number(params.id))
    if (!technique) throw new MarkingTechniqueNotFoundException()

    const payload = await request.validateUsing(updateMarkingTechniqueValidator)
    await this.service.update(technique, payload, adminActionContext(ctx))

    session.flash('success', i18n.t('markingTechniques.flash.updated'))
    return response.redirect().toRoute('admin.marking_techniques.index', { locale: i18n.locale })
  }

  /**
   * Supprime la technique. Refusée si des produits l'utilisent (flash
   * d'erreur + retour arrière).
   */
  async destroy(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageMarkingTechniques')

    const technique = await this.service.findById(Number(params.id))
    if (!technique) throw new MarkingTechniqueNotFoundException()

    try {
      await this.service.delete(technique, adminActionContext(ctx))
    } catch (error) {
      if (!(error instanceof MarkingTechniqueInUseException)) throw error
      session.flash('error', i18n.t('markingTechniques.flash.inUse'))
      return response.redirect().back()
    }

    session.flash('success', i18n.t('markingTechniques.flash.deleted'))
    return response.redirect().toRoute('admin.marking_techniques.index', { locale: i18n.locale })
  }
}
