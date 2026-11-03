import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminRfqInterventionService from '#services/admin_rfq_intervention_service'
import AdminTradeService from '#services/admin_trade_service'
import { adminRfqFiltersValidator, periodFilters } from '#validators/admin_trade'
import type { AdminRfqFilters } from '#shared/types/admin_trade'

const PER_PAGE = 25

/**
 * Supervision des demandes de devis (#166) : liste transverse filtrable, fiche
 * avec destinataires et devis, interventions (clôturer, faire expirer,
 * relancer). Lecture : `trade.view` ; interventions : `trade.manage` (admin).
 */
@inject()
export default class RfqController {
  constructor(
    private trade: AdminTradeService,
    private interventions: AdminRfqInterventionService
  ) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'trade.view')

    const query = await request.validateUsing(adminRfqFiltersValidator, { data: request.qs() })
    const filters: AdminRfqFilters = {
      ...periodFilters(query),
      status: query.status ?? null,
      attention: query.attention ?? null,
    }

    return inertia.render('admin/rfqs/index', {
      rfqs: await this.trade.listRfqs({ ...filters, page: query.page ?? 1, perPage: PER_PAGE }),
      filters,
    })
  }

  async show({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'trade.view')

    return inertia.render('admin/rfqs/show', { detail: await this.trade.rfqDetail(+params.id) })
  }

  async close(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'trade.manage')

    await this.interventions.close({ rfqId: +ctx.params.id, context: adminActionContext(ctx) })
    ctx.session.flash('success', ctx.i18n.t('admin.rfqs.done.closed'))
    return ctx.response.redirect().back()
  }

  async expire(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'trade.manage')

    await this.interventions.expire({ rfqId: +ctx.params.id, context: adminActionContext(ctx) })
    ctx.session.flash('success', ctx.i18n.t('admin.rfqs.done.expired'))
    return ctx.response.redirect().back()
  }

  async remind(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'trade.manage')

    const count = await this.interventions.remind({
      rfqId: +ctx.params.id,
      context: adminActionContext(ctx),
    })
    ctx.session.flash('success', ctx.i18n.t('admin.rfqs.done.reminded', { count }))
    return ctx.response.redirect().back()
  }
}
