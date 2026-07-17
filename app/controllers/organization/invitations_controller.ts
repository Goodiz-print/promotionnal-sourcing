import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import mail from '@adonisjs/mail/services/main'
import { signedUrlFor } from '@adonisjs/core/services/url_builder'
import { inviteMemberValidator } from '#validators/organization_invitation'
import OrganizationInvitationsService from '#services/organization_invitations_service'
import OrganizationInvitationNotification from '#mails/organization_invitation_notification'
import OrganizationInvitation from '#models/organization_invitation'
import {
  AlreadyMemberException,
  OrganizationInvitationNotFoundException,
} from '#exceptions/organization_errors'
import type Organization from '#models/organization'
import type User from '#models/user'

/**
 * Invitation de nouveaux membres par email (owner/admin/manager,
 * `canInviteMembers`). Aucun token en base : le lien envoyé s'appuie sur une
 * URL signée (cf. `InvitationAcceptanceController`).
 */
@inject()
export default class OrganizationInvitationsController {
  constructor(private service: OrganizationInvitationsService) {}

  /**
   * Envoie une invitation (ou relance une invitation en attente existante).
   */
  async store({ auth, bouncer, request, response, i18n, session }: HttpContext) {
    const org = await this.currentOrganization(auth.getUserOrFail())
    await bouncer.authorize('canInviteMembers', org)

    const payload = await request.validateUsing(inviteMemberValidator)

    try {
      const invitation = await this.service.invite(org, auth.getUserOrFail(), payload)
      await this.sendInvitationMail(invitation, org, auth.getUserOrFail(), i18n.locale)
      session.flash('success', i18n.t('organization.invitations.sent'))
    } catch (error) {
      if (error instanceof AlreadyMemberException) {
        session.flash('error', i18n.t('organization.invitations.alreadyMember'))
      } else {
        throw error
      }
    }

    return response.redirect().toRoute('organization.members', { locale: i18n.locale })
  }

  /**
   * Révoque une invitation en attente.
   */
  async destroy({ auth, bouncer, response, params, i18n, session }: HttpContext) {
    const org = await this.currentOrganization(auth.getUserOrFail())
    await bouncer.authorize('canInviteMembers', org)

    const invitation = await OrganizationInvitation.query()
      .where('id', params.id)
      .where('organizationId', org.id)
      .first()
    if (!invitation) throw new OrganizationInvitationNotFoundException()

    await this.service.revoke(invitation)
    session.flash('success', i18n.t('organization.invitations.revoked'))

    return response.redirect().toRoute('organization.members', { locale: i18n.locale })
  }

  private async sendInvitationMail(
    invitation: OrganizationInvitation,
    org: Organization,
    invitedBy: User,
    locale: string
  ) {
    const acceptUrl = signedUrlFor(
      'organization.invitations.show',
      { locale, id: invitation.id },
      { expiresIn: '7d', purpose: 'organization-invitation' }
    )

    await mail.sendLater(
      new OrganizationInvitationNotification(
        invitation.email,
        org.name,
        invitation.role.name,
        invitedBy.fullName ?? invitedBy.email,
        acceptUrl
      )
    )
  }

  private async currentOrganization(user: User): Promise<Organization> {
    await user.load('currentOrganization')
    if (!user.currentOrganization) {
      throw new Exception('No current organization', { status: 403, code: 'E_NO_CURRENT_ORG' })
    }
    return user.currentOrganization
  }
}
