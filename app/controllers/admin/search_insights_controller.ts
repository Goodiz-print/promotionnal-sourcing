import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import SearchInsightsService from '#services/search_insights_service'
import {
  searchInsightsFiltersValidator,
  normalizeSearchInsightsFilters,
} from '#validators/admin_search_insights'
import type { SearchInsightsFilters } from '#shared/types/search_insights'

/**
 * Écran admin « Ce que cherchent les clients » (#173) : agrégations des
 * journaux de recherche et d'activité. Droit requis : `monitoring.view`
 * (admin et analyst l'ont).
 */
@inject()
export default class SearchInsightsController {
  constructor(private service: SearchInsightsService) {}

  /**
   * GET /admin/search — Affiche le rapport (les filtres actifs sont dans `report.filters`).
   */
  async index({ bouncer, inertia, request, i18n }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'monitoring.view')

    const filters = await this.filters(request)
    const report = await this.service.report(filters, i18n.locale)

    return inertia.render('admin/search/index', { report })
  }

  /**
   * GET /admin/search/export — Télécharge le rapport en CSV.
   */
  async export({ bouncer, request, response, i18n }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'monitoring.view')

    const filters = await this.filters(request)
    const csv = await this.service.exportCsv(filters, i18n.locale)

    return response
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header(
        'Content-Disposition',
        `attachment; filename="search-insights-${filters.from}-to-${filters.to}.csv"`
      )
      .send(csv)
  }

  private async filters(request: HttpContext['request']): Promise<SearchInsightsFilters> {
    const query = await request.validateUsing(searchInsightsFiltersValidator, {
      data: request.qs(),
    })
    return normalizeSearchInsightsFilters(query)
  }
}
