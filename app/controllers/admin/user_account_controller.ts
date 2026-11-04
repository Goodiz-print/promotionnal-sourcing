import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminUserActionService from '#services/admin_user_action_service'
import { suspendUserValidator } from '#validators/admin_user'
import {
  CannotActOnSelfException,
  CannotActOnPlatformAdminException,
  UserAlreadySuspendedException,
  UserNotSuspendedException,
  UserAlreadyVerifiedException,
  UserOwnsOrganizationsException,
} from '#exceptions/admin_user_errors'

/**
 * Actions d'administration sur les comptes utilisateurs (#160) : suspension,
 * réactivation, renvoi de vérification, reset de mot de passe, suppression.
 *
 * - `users.support` (admin, support) : resend verification, password reset
 * - `users.manage` (admin) : suspend, reactivate, destroy
 */
@inject()
export default class UserAccountController {
  constructor(private actions: AdminUserActionService) {}

  async suspend(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'users.manage')

    const { reason } = await request.validateUsing(suspendUserValidator)

    try {
      await this.actions.suspend(Number(params.id), {
        context: adminActionContext(ctx),
        reason,
      })
    } catch (error) {
      if (error instanceof CannotActOnSelfException) {
        session.flash('error', i18n.t('admin.users.actions.suspend.selfError'))
        return response.redirect().back()
      }
      if (error instanceof CannotActOnPlatformAdminException) {
        session.flash('error', i18n.t('admin.users.actions.suspend.adminError'))
        return response.redirect().back()
      }
      if (error instanceof UserAlreadySuspendedException) {
        session.flash('error', i18n.t('admin.users.actions.suspend.alreadySuspended'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.users.actions.suspend.done'))
    return response.redirect().back()
  }

  async reactivate(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'users.manage')

    try {
      await this.actions.reactivate(Number(params.id), {
        context: adminActionContext(ctx),
      })
    } catch (error) {
      if (error instanceof UserNotSuspendedException) {
        session.flash('error', i18n.t('admin.users.actions.reactivate.notSuspended'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.users.actions.reactivate.done'))
    return response.redirect().back()
  }

  async resendVerification(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'users.support')

    try {
      await this.actions.resendVerification(Number(params.id), {
        context: adminActionContext(ctx),
        locale: i18n.locale,
      })
    } catch (error) {
      if (error instanceof UserAlreadyVerifiedException) {
        session.flash('error', i18n.t('admin.users.actions.resendVerification.alreadyVerified'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.users.actions.resendVerification.done'))
    return response.redirect().back()
  }

  async passwordReset(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'users.support')

    await this.actions.requestPasswordReset(Number(params.id), {
      context: adminActionContext(ctx),
      locale: i18n.locale,
    })

    session.flash('success', i18n.t('admin.users.actions.passwordReset.done'))
    return response.redirect().back()
  }

  async destroy(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'users.manage')

    try {
      await this.actions.destroy(Number(params.id), {
        context: adminActionContext(ctx),
      })
    } catch (error) {
      if (error instanceof CannotActOnSelfException) {
        session.flash('error', i18n.t('admin.users.actions.destroy.selfError'))
        return response.redirect().back()
      }
      if (error instanceof CannotActOnPlatformAdminException) {
        session.flash('error', i18n.t('admin.users.actions.destroy.adminError'))
        return response.redirect().back()
      }
      if (error instanceof UserOwnsOrganizationsException) {
        session.flash(
          'error',
          i18n.t('admin.users.actions.destroy.ownsOrganizations', {
            organizations: error.blockingOrganizations.join(', '),
          })
        )
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.users.actions.destroy.done'))
    return response.redirect().toRoute('admin.users.index', { locale: i18n.locale })
  }
}
