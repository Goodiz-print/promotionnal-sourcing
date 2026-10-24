import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import DashboardService from '#services/dashboard_service'
import OrganizationContextService from '#services/organization_context_service'

/**
 * Tableau de bord affiché après la connexion : synthèse de l'organisation
 * courante, côté acheteur et/ou fournisseur. Gardé par `auth` + `onboarded`.
 */
@inject()
export default class DashboardController {
  constructor(
    private context: OrganizationContextService,
    private service: DashboardService
  ) {}

  async show({ auth, inertia }: HttpContext) {
    const organization = await this.context.currentFor(auth.getUserOrFail())
    return inertia.render('dashboard/show', {
      dashboard: await this.service.forOrganization(organization),
    })
  }
}
