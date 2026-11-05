import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { errors } from '@vinejs/vine'
import AdminDashboardService from '#services/admin_dashboard_service'
import AdminKpiService from '#services/admin_kpi_service'
import HealthService from '#services/health_service'
import { adminPeriodValidator } from '#validators/admin_period'

/**
 * Tableau de bord du back-office : compteurs plateforme (tous les rôles qui ont
 * accès au back-office) et indicateurs KPI sur une période (droit
 * `monitoring.view` : `admin` et `analyst`). L'accès au back-office est garanti
 * par le middleware `platformAdmin` du groupe de routes `/admin`.
 */
@inject()
export default class DashboardController {
  constructor(
    private service: AdminDashboardService,
    private kpis: AdminKpiService,
    private health: HealthService
  ) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    const stats = await this.service.stats()
    // Santé de la queue (#175) : réservée au droit `queue.manage`, comme l'écran de supervision.
    const queue = (await bouncer.allows('hasPlatformPermission', 'queue.manage'))
      ? await this.health.queueReport()
      : null
    if (await bouncer.denies('hasPlatformPermission', 'monitoring.view')) {
      return inertia.render('admin/dashboard', { stats, kpis: null, filters: null, queue })
    }

    const query = await request.validateUsing(adminPeriodValidator, { data: request.qs() })
    if (query.from && query.to && query.to < query.from) {
      throw new errors.E_VALIDATION_ERROR([
        { field: 'to', message: 'La date de fin précède la date de début', rule: 'afterOrEqual' },
      ])
    }
    const filters = this.kpis.resolveFilters(query)

    return inertia.render('admin/dashboard', {
      stats,
      kpis: await this.kpis.report(filters),
      filters,
      queue,
    })
  }
}
