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
  InvitationNotPendingException,
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
   * Renvoie le mail d'une invitation en attente (nouveau lien signé, expiration
   * prolongée) sans en créer une seconde.
   */
  async resend({ auth, bouncer, response, params, i18n, session }: HttpContext) {
    const org = await this.currentOrganization(auth.getUserOrFail())
    await bouncer.authorize('canInviteMembers', org)

    const invitation = await this.findInOrganization(params.id, org.id)

    try {
      await this.service.resend(invitation)
      await this.sendInvitationMail(invitation, org, invitation.invitedBy, i18n.locale)
      session.flash('success', i18n.t('organization.invitations.resent'))
    } catch (error) {
      if (error instanceof InvitationNotPendingException) {
        session.flash('error', i18n.t('organization.invitations.notPending'))
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

    const invitation = await this.findInOrganization(params.id, org.id)

    await this.service.revoke(invitation)
    session.flash('success', i18n.t('organization.invitations.revoked'))

    return response.redirect().toRoute('organization.members', { locale: i18n.locale })
  }

  /**
   * Charge une invitation en la bornant à l'organisation courante — un id
   * appartenant à une autre organisation est un 404, pas un 403 (pas de fuite
   * d'existence).
   */
  private async findInOrganization(id: number, organizationId: number) {
    const invitation = await OrganizationInvitation.query()
      .where('id', id)
      .where('organizationId', organizationId)
      .first()
    if (!invitation) throw new OrganizationInvitationNotFoundException()
    return invitation
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
