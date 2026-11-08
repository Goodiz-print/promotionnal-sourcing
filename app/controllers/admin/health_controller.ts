import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import HealthMonitorService from '#services/health_monitor_service'
import HealthProbeService from '#services/health_probe_service'

/**
 * Santé de la plateforme (#179), droit `ops.manage` (admin). Sonde en direct à
 * chaque affichage et y joint l'état conservé par le job de surveillance
 * (depuis quand, passes en échec, alerte envoyée).
 */
@inject()
export default class HealthController {
  constructor(
    private probes: HealthProbeService,
    private monitor: HealthMonitorService
  ) {}

  async index({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    const [report, summary] = await Promise.all([this.probes.report(), this.monitor.summary()])
    return inertia.render('admin/health/index', { report, summary })
  }
}
