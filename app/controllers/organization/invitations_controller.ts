import type { Locale } from '#shared/types/i18n'
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { signedUrlFor } from '@adonisjs/core/services/url_builder'
import { inviteMemberValidator } from '#validators/organization_invitation'
import OrganizationInvitationsService from '#services/organization_invitations_service'
import SendMailJob from '#jobs/send_mail_job'
import { mailSendKey } from '#shared/helpers/mail'
import { MAIL_KINDS } from '#shared/types/mail'
import OrganizationInvitation from '#models/organization_invitation'
import {
  AlreadyMemberException,
  InvitationNotPendingException,
  OrganizationInvitationNotFoundException,
} from '#exceptions/organization_errors'
import type Organization from '#models/organization'
import type User from '#models/user'
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
    const org = await this.organizations.currentFor(auth.getUserOrFail())
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
    const org = await this.organizations.currentFor(auth.getUserOrFail())
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

  /**
   * Met le mail d'invitation en **queue** (`SendMailJob`, table `queue_jobs`) et
   * non dans la file mémoire de `@adonisjs/mail` : un redémarrage du process ne
   * perd plus l'invitation, et un SMTP indisponible est rejoué. La charge ne
   * contient que des données déjà résolues (elle transite par la base).
   */
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

    await SendMailJob.dispatch({
      kind: MAIL_KINDS.organizationInvitation,
      // Un renvoi est un nouvel envoi voulu : la clé ne dédoublonne que les rejeux.
      idempotencyKey: mailSendKey(MAIL_KINDS.organizationInvitation, {
        invitation: invitation.id,
      }),
      to: invitation.email,
      // Langue de l'inviteur : l'invité n'a pas encore de compte, donc pas de langue connue.
      locale: locale as Locale,
      data: {
        organizationName: org.name,
        roleName: invitation.role.name,
        inviterName: invitedBy.fullName ?? invitedBy.email,
        acceptUrl,
      },
    })
  }
}
