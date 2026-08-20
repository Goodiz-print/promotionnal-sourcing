import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { updateMemberRoleValidator } from '#validators/organization_member'
import OrganizationMembersService from '#services/organization_members_service'
import OrganizationInvitationsService from '#services/organization_invitations_service'
import OrganizationMemberTransformer from '#transformers/organization_member_transformer'
import OrganizationInvitationTransformer from '#transformers/organization_invitation_transformer'
import RoleTransformer from '#transformers/role_transformer'
import Role from '#models/role'
import { LastOwnerException } from '#exceptions/organization_errors'
import OrganizationContextService from '#services/organization_context_service'

/**
 * Gestion des membres de l'organisation courante (liste, changement de
 * rôle, retrait) et des invitations en attente. Écran accessible dès
 * `canInviteMembers` (owner/admin/manager) ; le changement de rôle et le
 * retrait restent réservés à `canManageMembers` (owner/admin), cf. `update`/
 * `destroy` — `canManageMembers` est aussi renvoyé en prop pour masquer ces
 * contrôles côté écran quand l'utilisateur ne peut pas s'en servir.
 */
@inject()
export default class OrganizationMembersController {
  constructor(
    private service: OrganizationMembersService,
    private invitationsService: OrganizationInvitationsService,
    private organizations: OrganizationContextService
  ) {}

  /**
   * Écran listant les membres et les invitations en attente de l'organisation
   * courante.
   */
  async index({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canInviteMembers', org)

    const [members, invitations, roles] = await Promise.all([
      this.service.listMembers(org.id),
      this.invitationsService.listPending(org.id),
      Role.all(),
    ])

    return inertia.render('organization/members', {
      members: members.map((member) => new OrganizationMemberTransformer(member).toObject()),
      invitations: invitations.map((invitation) =>
        new OrganizationInvitationTransformer(invitation).toObject()
      ),
      roles: roles.map((role) => new RoleTransformer(role).toObject()),
      canManageMembers: await bouncer.allows('canManageMembers', org),
    })
  }

  /**
   * Change le rôle d'un membre.
   */
  async update({ auth, bouncer, request, response, params, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageMembers', org)

    const member = await this.service.findMember(org.id, Number(params.id))
    const { roleId } = await request.validateUsing(updateMemberRoleValidator)

    try {
      await this.service.changeRole(member, roleId)
      session.flash('success', i18n.t('organization.members.roleUpdated'))
    } catch (error) {
      if (error instanceof LastOwnerException) {
        session.flash('error', i18n.t('organization.members.lastOwnerError'))
      } else {
        throw error
      }
    }

    return response.redirect().toRoute('organization.members', { locale: i18n.locale })
  }

  /**
   * Retire un membre de l'organisation.
   */
  async destroy({ auth, bouncer, response, params, i18n, session }: HttpContext) {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageMembers', org)

    const member = await this.service.findMember(org.id, Number(params.id))

    try {
      await this.service.removeMember(member)
      session.flash('success', i18n.t('organization.members.removed'))
    } catch (error) {
      if (error instanceof LastOwnerException) {
        session.flash('error', i18n.t('organization.members.lastOwnerError'))
      } else {
        throw error
      }
    }

    return response.redirect().toRoute('organization.members', { locale: i18n.locale })
  }
}
