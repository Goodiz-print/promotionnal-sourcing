import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminUserService from '#services/admin_user_service'
import PlatformAdminService from '#services/platform_admin_service'
import { updatePlatformRoleValidator } from '#validators/admin_user'
import {
  AdminUserNotFoundException,
  CannotChangeOwnPlatformRoleException,
} from '#exceptions/admin_errors'

/**
 * Attribution des rôles plateforme depuis l'écran Utilisateurs. Réservé au
 * droit `roles.manage` (admin plateforme) ; le changement est audité par
 * `PlatformAdminService`. Un admin ne modifie pas son propre rôle.
 */
@inject()
export default class PlatformRoleController {
  constructor(
    private users: AdminUserService,
    private platformAdmin: PlatformAdminService
  ) {}

  async update(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'roles.manage')

    const target = await this.users.find(Number(params.id))
    if (!target) throw new AdminUserNotFoundException()

    const { platformRole } = await request.validateUsing(updatePlatformRoleValidator)

    try {
      await this.platformAdmin.changeRole(target, platformRole, adminActionContext(ctx))
    } catch (error) {
      if (!(error instanceof CannotChangeOwnPlatformRoleException)) throw error
      session.flash('error', i18n.t('admin.users.roles.ownRole'))
      return response.redirect().back()
    }

    session.flash('success', i18n.t('admin.users.roles.updated'))
    return response.redirect().back()
  }
}
