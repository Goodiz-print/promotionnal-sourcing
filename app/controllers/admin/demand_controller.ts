import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminDemandService from '#services/admin_demand_service'
import { adminDemandFiltersValidator } from '#validators/admin_demand'
import type { AdminDemandFilters } from '#shared/types/admin_demand'

/**
 * « Ce que cherchent les clients » (#173) : recherches, requêtes sans résultat,
 * consultations et demandes de devis, sur une période. Droit `monitoring.view`
 * (rôles `admin` et `analyst`).
 */
@inject()
export default class DemandController {
  constructor(private service: AdminDemandService) {}

  async index({ bouncer, inertia, request, i18n }: HttpContext) {
    const filters = await this.filters({ bouncer, request })
    const report = await this.service.report(filters, i18n.locale)

    return inertia.render('admin/demand/index', { report, filters })
  }

  /** Export CSV des requêtes de la période, avec les mêmes filtres que l'écran. */
  async export({ bouncer, request, response, i18n }: HttpContext) {
    const filters = await this.filters({ bouncer, request })
    const csv = await this.service.queriesCsv(filters, [
      i18n.t('admin.demand.columns.query'),
      i18n.t('admin.demand.columns.searches'),
      i18n.t('admin.demand.columns.averageResults'),
      i18n.t('admin.demand.columns.zeroResults'),
    ])

    response.header('Content-Type', 'text/csv; charset=utf-8')
    response.header(
      'Content-Disposition',
      `attachment; filename="requetes-${filters.from}-${filters.to}.csv"`
    )
    return response.send(csv)
  }

  private async filters({
    bouncer,
    request,
  }: Pick<HttpContext, 'bouncer' | 'request'>): Promise<AdminDemandFilters> {
    await bouncer.authorize('hasPlatformPermission', 'monitoring.view')

    const query = await request.validateUsing(adminDemandFiltersValidator, {
      data: request.qs(),
    })
    const defaults = this.service.defaultFilters()
    return {
      from: query.from ?? defaults.from,
      to: query.to ?? defaults.to,
      source: query.source ?? null,
      locale: query.locale ?? null,
      organizationType: query.organizationType ?? null,
    }
  }
}
