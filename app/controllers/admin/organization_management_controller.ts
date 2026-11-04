import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminOrganizationActionService from '#services/admin_organization_action_service'
import { LastOwnerException, InvitationNotPendingException } from '#exceptions/organization_errors'
import {
  adminOrganizationUpdateValidator,
  adminOrganizationTypeValidator,
  adminOrganizationMemberRoleValidator,
} from '#validators/admin_organization'
import {
  OrganizationAlreadyArchivedException,
  OrganizationNotArchivedException,
  OrganizationHasSupplierDataException,
  AdminOrganizationMemberNotFoundException,
  AdminOrganizationInvitationNotFoundException,
} from '#exceptions/admin_organization_errors'
import type { Locale } from '#shared/types/i18n'

/**
 * Actions d'administration sur les organisations (#161) : archivage, restauration,
 * modification, changement de type, gestion des membres et invitations.
 * Droit `organizations.manage` (admin seul).
 */
@inject()
export default class OrganizationManagementController {
  constructor(private actions: AdminOrganizationActionService) {}

  /**
   * Archive une organisation.
   */
  async archive(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    try {
      await this.actions.archive(Number(params.id), {
        context: adminActionContext(ctx),
      })
    } catch (error) {
      if (error instanceof OrganizationAlreadyArchivedException) {
        session.flash('error', i18n.t('admin.organizations.actions.archive.alreadyArchived'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.organizations.actions.archive.done'))
    return response.redirect().back()
  }

  /**
   * Restaure une organisation archivee.
   */
  async restore(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    try {
      await this.actions.restore(Number(params.id), {
        context: adminActionContext(ctx),
      })
    } catch (error) {
      if (error instanceof OrganizationNotArchivedException) {
        session.flash('error', i18n.t('admin.organizations.actions.restore.notArchived'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.organizations.actions.restore.done'))
    return response.redirect().back()
  }

  /**
   * Modifie les informations d'une organisation.
   */
  async update(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    const data = await request.validateUsing(adminOrganizationUpdateValidator)

    const { changed } = await this.actions.update(Number(params.id), {
      context: adminActionContext(ctx),
      data,
    })

    if (changed) {
      session.flash('success', i18n.t('admin.organizations.actions.update.done'))
    } else {
      session.flash('info', i18n.t('admin.organizations.actions.update.noChange'))
    }

    return response.redirect().back()
  }

  /**
   * Change le type d'une organisation.
   */
  async changeType(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    const { organizationType } = await request.validateUsing(adminOrganizationTypeValidator)

    try {
      const { changed } = await this.actions.changeType(Number(params.id), {
        context: adminActionContext(ctx),
        organizationType,
      })

      if (changed) {
        session.flash('success', i18n.t('admin.organizations.actions.changeType.done'))
      } else {
        session.flash('info', i18n.t('admin.organizations.actions.changeType.noChange'))
      }
    } catch (error) {
      if (error instanceof OrganizationHasSupplierDataException) {
        session.flash('error', i18n.t('admin.organizations.actions.changeType.hasSupplierData'))
        return response.redirect().back()
      }
      throw error
    }

    return response.redirect().back()
  }

  /**
   * Change le role d'un membre.
   */
  async changeMemberRole(ctx: HttpContext) {
    const { bouncer, request, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    const { roleId } = await request.validateUsing(adminOrganizationMemberRoleValidator)

    try {
      await this.actions.changeMemberRole(Number(params.id), {
        context: adminActionContext(ctx),
        membershipId: Number(params.membershipId),
        roleId,
      })
    } catch (error) {
      if (error instanceof AdminOrganizationMemberNotFoundException) {
        session.flash('error', i18n.t('admin.organizations.actions.member.notFound'))
        return response.redirect().back()
      }
      if (error instanceof LastOwnerException) {
        session.flash('error', i18n.t('admin.organizations.actions.member.lastOwner'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.organizations.actions.member.roleChanged'))
    return response.redirect().back()
  }

  /**
   * Retire un membre de l'organisation.
   */
  async removeMember(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    try {
      await this.actions.removeMember(Number(params.id), {
        context: adminActionContext(ctx),
        membershipId: Number(params.membershipId),
      })
    } catch (error) {
      if (error instanceof AdminOrganizationMemberNotFoundException) {
        session.flash('error', i18n.t('admin.organizations.actions.member.notFound'))
        return response.redirect().back()
      }
      if (error instanceof LastOwnerException) {
        session.flash('error', i18n.t('admin.organizations.actions.member.lastOwner'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.organizations.actions.member.removed'))
    return response.redirect().back()
  }

  /**
   * Revoque une invitation en attente.
   */
  async revokeInvitation(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    try {
      await this.actions.revokeInvitation(Number(params.id), {
        context: adminActionContext(ctx),
        invitationId: Number(params.invitationId),
      })
    } catch (error) {
      if (error instanceof AdminOrganizationInvitationNotFoundException) {
        session.flash('error', i18n.t('admin.organizations.actions.invitation.notFound'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.organizations.actions.invitation.revoked'))
    return response.redirect().back()
  }

  /**
   * Renvoie une invitation en attente.
   */
  async resendInvitation(ctx: HttpContext) {
    const { bouncer, response, params, i18n, session } = ctx
    await bouncer.authorize('hasPlatformPermission', 'organizations.manage')

    try {
      await this.actions.resendInvitation(Number(params.id), {
        context: adminActionContext(ctx),
        invitationId: Number(params.invitationId),
        locale: i18n.locale as Locale,
      })
    } catch (error) {
      if (error instanceof AdminOrganizationInvitationNotFoundException) {
        session.flash('error', i18n.t('admin.organizations.actions.invitation.notFound'))
        return response.redirect().back()
      }
      if (error instanceof InvitationNotPendingException) {
        session.flash('error', i18n.t('admin.organizations.actions.invitation.notPending'))
        return response.redirect().back()
      }
      throw error
    }

    session.flash('success', i18n.t('admin.organizations.actions.invitation.resent'))
    return response.redirect().back()
  }
}
