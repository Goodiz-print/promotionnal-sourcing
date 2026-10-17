import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminDashboardService from '#services/admin_dashboard_service'

/**
 * Tableau de bord du back-office : compteurs plateforme. L'accès est garanti
 * par le middleware `platformAdmin` du groupe de routes `/admin`.
 */
@inject()
export default class DashboardController {
  constructor(private service: AdminDashboardService) {}

  async index({ inertia }: HttpContext) {
    return inertia.render('admin/dashboard', { stats: await this.service.stats() })
  }
}
