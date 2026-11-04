import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminTradeService from '#services/admin_trade_service'
import { adminQuoteFiltersValidator, periodFilters } from '#validators/admin_trade'
import type { AdminQuoteFilters } from '#shared/types/admin_trade'

const PER_PAGE = 25

/**
 * Supervision des devis (#166) en lecture seule : liste transverse filtrable
 * et fiche. Droit `trade.view` (admin, support, analyste).
 */
@inject()
export default class QuoteController {
  constructor(private trade: AdminTradeService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'trade.view')

    const query = await request.validateUsing(adminQuoteFiltersValidator, { data: request.qs() })
    const filters: AdminQuoteFilters = { ...periodFilters(query), status: query.status ?? null }

    return inertia.render('admin/quotes/index', {
      quotes: await this.trade.listQuotes({ ...filters, page: query.page ?? 1, perPage: PER_PAGE }),
      filters,
    })
  }

  async show({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'trade.view')

    return inertia.render('admin/quotes/show', { detail: await this.trade.quoteDetail(+params.id) })
  }
}
