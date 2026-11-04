import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import CertificationService from '#services/certification_service'
import CertificationAdminTransformer from '#transformers/certification_admin_transformer'
import CertificationEditTransformer from '#transformers/certification_edit_transformer'
import {
  CertificationNotFoundException,
  CertificationInUseException,
} from '#exceptions/catalogue_errors'
import {
  createCertificationValidator,
  updateCertificationValidator,
} from '#validators/certification'
import type { Locale } from '#shared/types/i18n'

/**
 * Administration des certifications du catalogue (#165). CRUD réservé à
 * l'admin plateforme (ability `canManageCertifications`). Controller fin :
 * autorisation + validation -> service.
 */
@inject()
export default class CertificationController {
  constructor(private service: CertificationService) {}

  async index({ bouncer, inertia, i18n }: HttpContext) {
    await bouncer.authorize('canManageCertifications')
    const locale = i18n.locale as Locale

    const certifications = await this.service.listForAdmin()

    return inertia.render('admin/certifications/index', {
      certifications: certifications.map((certification) =>
        new CertificationAdminTransformer(certification, locale).toObject()
      ),
    })
  }

  async create({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('canManageCertifications')

    return inertia.render('admin/certifications/create', {})
  }

  /**
   * Crée la certification puis ouvre son écran d'édition.
   */
  async store(ctx: HttpContext) {
    const { bouncer, request, response, i18n, session } = ctx
    await bouncer.authorize('canManageCertifications')

    const payload = await request.validateUsing(createCertificationValidator)
    const certification = await this.service.create(payload, adminActionContext(ctx))

    session.flash('success', i18n.t('certifications.flash.created'))
    return response
      .redirect()
      .toRoute('admin.certifications.edit', { locale: i18n.locale, id: certification.id })
  }

  async edit({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('canManageCertifications')

    const certification = await this.service.findForEdit(Number(params.id))
    if (!certification) throw new CertificationNotFoundException()

    return inertia.render('admin/certifications/edit', {
      certification: new CertificationEditTransformer(certification).toObject(),
    })
  }

  async update(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageCertifications')

    const certification = await this.service.findById(Number(params.id))
    if (!certification) throw new CertificationNotFoundException()

    const payload = await request.validateUsing(updateCertificationValidator)
    await this.service.update(certification, payload, adminActionContext(ctx))

    session.flash('success', i18n.t('certifications.flash.updated'))
    return response.redirect().toRoute('admin.certifications.index', { locale: i18n.locale })
  }

  /**
   * Supprime la certification. Refusée si des produits la portent (flash
   * d'erreur + retour arrière).
   */
  async destroy(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('canManageCertifications')

    const certification = await this.service.findById(Number(params.id))
    if (!certification) throw new CertificationNotFoundException()

    try {
      await this.service.delete(certification, adminActionContext(ctx))
    } catch (error) {
      if (!(error instanceof CertificationInUseException)) throw error
      session.flash('error', i18n.t('certifications.flash.inUse'))
      return response.redirect().back()
    }

    session.flash('success', i18n.t('certifications.flash.deleted'))
    return response.redirect().toRoute('admin.certifications.index', { locale: i18n.locale })
  }
}
