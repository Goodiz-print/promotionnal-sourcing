import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminTradeService from '#services/admin_trade_service'
import { adminOrderFiltersValidator, periodFilters } from '#validators/admin_trade'
import type { AdminOrderFilters } from '#shared/types/admin_trade'

const PER_PAGE = 25

/**
 * Supervision des commandes (#166) en lecture seule : liste transverse filtrable
 * et fiche. Droit `trade.view` (admin, support, analyste).
 */
@inject()
export default class OrderController {
  constructor(private trade: AdminTradeService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'trade.view')

    const query = await request.validateUsing(adminOrderFiltersValidator, { data: request.qs() })
    const filters: AdminOrderFilters = { ...periodFilters(query), status: query.status ?? null }

    return inertia.render('admin/orders/index', {
      orders: await this.trade.listOrders({ ...filters, page: query.page ?? 1, perPage: PER_PAGE }),
      filters,
    })
  }

  async show({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'trade.view')

    return inertia.render('admin/orders/show', { detail: await this.trade.orderDetail(+params.id) })
  }
}
