import type { Locale } from '#shared/types/i18n'
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { inviteMemberValidator } from '#validators/organization_invitation'
import OrganizationInvitationsService from '#services/organization_invitations_service'
import OrganizationInvitation from '#models/organization_invitation'
import {
  AlreadyMemberException,
  InvitationNotPendingException,
  OrganizationInvitationNotFoundException,
} from '#exceptions/organization_errors'
import OrganizationContextService from '#services/organization_context_service'

/**
 * Invitation de nouveaux membres par email (owner/admin/manager,
 * `canInviteMembers`). Aucun token en base : le lien envoyé s'appuie sur une
 * URL signée (cf. `InvitationAcceptanceController`).
 */
@inject()
export default class OrganizationInvitationsController {
  constructor(
    private service: OrganizationInvitationsService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Envoie une invitation (ou relance une invitation en attente existante).
   */
  async store({ auth, bouncer, request, response, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canInviteMembers', org)

    const payload = await request.validateUsing(inviteMemberValidator)

    try {
      const invitation = await this.service.invite(org, auth.getUserOrFail(), payload)
      await this.service.sendMail(
        invitation,
        org,
        auth.getUserOrFail().fullName ?? auth.getUserOrFail().email,
        i18n.locale as Locale
      )
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
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canInviteMembers', org)

    const invitation = await this.findInOrganization(params.id, org.id)

    try {
      await this.service.resend(invitation)
      await this.service.sendMail(
        invitation,
        org,
        invitation.invitedBy.fullName ?? invitation.invitedBy.email,
        i18n.locale as Locale
      )
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
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canInviteMembers', org)

    const invitation = await this.findInOrganization(params.id, org.id)

    try {
      await this.service.revoke(invitation)
      session.flash('success', i18n.t('organization.invitations.revoked'))
    } catch (error) {
      if (!(error instanceof InvitationNotPendingException)) throw error
      session.flash('error', i18n.t('organization.invitations.notPending'))
    }

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
}
