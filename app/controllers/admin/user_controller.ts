import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminUserService from '#services/admin_user_service'
import AdminUserTransformer from '#transformers/admin_user_transformer'
import AdminUserDetailTransformer from '#transformers/admin_user_detail_transformer'
import { adminUserFiltersValidator } from '#validators/admin_user'
import { AdminUserNotFoundException } from '#exceptions/admin_errors'
import { PLATFORM_ROLES } from '#shared/types/user'
import { ORGANIZATION_TYPES } from '#shared/types/organization'
import type { AdminUserIndexFilters, AdminUserFilterOptions } from '#shared/types/admin_user'

const PER_PAGE = 25

/**
 * Consultation des comptes utilisateurs par l'équipe plateforme (#160) :
 * liste paginée avec filtres étendus, fiche détaillée. Droit `users.view` ;
 * la gestion des rôles plateforme vit dans `PlatformRoleController`, les
 * actions (suspension, suppression…) dans `UserAccountController`.
 */
@inject()
export default class UserController {
  constructor(private service: AdminUserService) {}

  async index({ auth, bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'users.view')

    const query = await request.validateUsing(adminUserFiltersValidator, { data: request.qs() })

    const filters: AdminUserIndexFilters = {
      search: query.search || null,
      platformRole: query.platformRole ?? null,
      emailVerified: query.emailVerified ?? null,
      activity: query.activity ?? null,
      organizationType: query.organizationType ?? null,
      status: query.status ?? null,
    }

    const paginator = await this.service.list({
      ...filters,
      page: query.page ?? 1,
      perPage: PER_PAGE,
    })

    // Options de filtres pour le frontend
    const filterOptions: AdminUserFilterOptions = {
      platformRoles: [...PLATFORM_ROLES.filter((r) => r !== 'none'), 'any-role'],
      organizationTypes: [...ORGANIZATION_TYPES],
    }

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
      filterOptions,
      canManageRoles: await bouncer.allows('hasPlatformPermission', 'roles.manage'),
      canSupport: await bouncer.allows('hasPlatformPermission', 'users.support'),
      canManage: await bouncer.allows('hasPlatformPermission', 'users.manage'),
      currentUserId: auth.getUserOrFail().id,
    })
  }

  async show({ auth, bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'users.view')

    const user = await this.service.detail(Number(params.id))
    if (!user) throw new AdminUserNotFoundException()

    const canSupport = await bouncer.allows('hasPlatformPermission', 'users.support')
    const canManage = await bouncer.allows('hasPlatformPermission', 'users.manage')
    const currentUserId = auth.getUserOrFail().id

    return inertia.render('admin/users/show', {
      // `user` est déjà une prop partagée (l'utilisateur connecté) : ne pas l'écraser.
      account: new AdminUserDetailTransformer(
        user,
        currentUserId,
        canSupport,
        canManage
      ).toObject(),
      canManageRoles: await bouncer.allows('hasPlatformPermission', 'roles.manage'),
    })
  }
}
