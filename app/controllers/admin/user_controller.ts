import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminUserService from '#services/admin_user_service'
import AdminUserTransformer from '#transformers/admin_user_transformer'
import type { AdminUserFilters } from '#shared/types/admin'

const PER_PAGE = 25

/**
 * Consultation des comptes utilisateurs par l'équipe plateforme (liste
 * paginée, recherche par email).
 */
@inject()
export default class UserController {
  constructor(private service: AdminUserService) {}

  async index({ inertia, request }: HttpContext) {
    const qs = request.qs()
    const filters: AdminUserFilters = {
      search: typeof qs.search === 'string' && qs.search.trim() ? qs.search.trim() : null,
    }
    const page = Number.parseInt(qs.page, 10) || 1

    const paginator = await this.service.list({ ...filters, page, perPage: PER_PAGE })

    return inertia.render('admin/users/index', {
      users: {
        data: paginator.all().map((user) => new AdminUserTransformer(user).toObject()),
        meta: {
          total: paginator.total,
          perPage: paginator.perPage,
          currentPage: paginator.currentPage,
          lastPage: paginator.lastPage,
        },
      },
      filters,
    })
  }
}
