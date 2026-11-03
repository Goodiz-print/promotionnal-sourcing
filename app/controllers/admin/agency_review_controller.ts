import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminAgencyReviewService from '#services/admin_agency_review_service'
import {
  agencyReviewDecisionValidator,
  agencyReviewFiltersValidator,
} from '#validators/admin_agency_review'
import type { AdminAgencyReviewFilters } from '#shared/types/agency_review'

const PER_PAGE = 25

/**
 * File de revue des inscriptions agence du back-office (droit
 * `moderation.manage`) : agences à revoir avec leurs motifs et contrôles
 * (VIES, domaine), historique, décision approuver / rejeter / demander des
 * informations.
 */
@inject()
export default class AgencyReviewController {
  constructor(private service: AdminAgencyReviewService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'moderation.manage')

    const query = await request.validateUsing(agencyReviewFiltersValidator, {
      data: request.qs(),
    })
    const filters: AdminAgencyReviewFilters = { status: query.status ?? 'open' }

    return inertia.render('admin/agency_reviews/index', {
      queue: await this.service.list({ ...filters, page: query.page ?? 1, perPage: PER_PAGE }),
      filters,
    })
  }

  async show({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'moderation.manage')

    return inertia.render('admin/agency_reviews/show', {
      detail: await this.service.detail(Number(params.id)),
    })
  }

  async decide(ctx: HttpContext) {
    const { bouncer, request, response, params, session, i18n, auth } = ctx
    await bouncer.authorize('hasPlatformPermission', 'moderation.manage')

    const { decision, reason } = await request.validateUsing(agencyReviewDecisionValidator)
    await this.service.decide({
      organizationId: Number(params.id),
      decision,
      reason: reason ?? null,
      decidedBy: auth.getUserOrFail(),
      context: adminActionContext(ctx),
    })

    session.flash('success', i18n.t(`admin.agencyReviews.decided.${decision}`))
    return response.redirect().back()
  }
}
