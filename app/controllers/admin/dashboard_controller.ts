import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { errors } from '@vinejs/vine'
import searchConfig from '#config/search'
import AdminDashboardService from '#services/admin_dashboard_service'
import AdminKpiService from '#services/admin_kpi_service'
import HealthMonitorService from '#services/health_monitor_service'
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
    private health: HealthService,
    private monitor: HealthMonitorService
  ) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    const stats = await this.service.stats()
    // Santé de la queue (#175) : réservée au droit `queue.manage`, comme l'écran de supervision.
    const queue = (await bouncer.allows('hasPlatformPermission', 'queue.manage'))
      ? await this.health.queueReport()
      : null
    // Santé de la plateforme (#179) : derniers états du job de surveillance, sans sonder.
    const platform = (await bouncer.allows('hasPlatformPermission', 'ops.manage'))
      ? await this.monitor.summary()
      : null
    // Recherche inerte (#176) : sans `MEILISEARCH_HOST`, rien n'est indexé et personne n'est prévenu.
    const searchDisabled =
      !searchConfig.enabled && (await bouncer.allows('hasPlatformPermission', 'search.manage'))
    if (await bouncer.denies('hasPlatformPermission', 'monitoring.view')) {
      return inertia.render('admin/dashboard', {
        stats,
        kpis: null,
        filters: null,
        queue,
        platform,
        searchDisabled,
      })
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
      platform,
      searchDisabled,
    })
  }
}
