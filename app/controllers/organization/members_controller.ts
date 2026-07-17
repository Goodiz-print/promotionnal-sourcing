import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import { updateMemberRoleValidator } from '#validators/organization_member'
import OrganizationMembersService from '#services/organization_members_service'
import OrganizationMemberTransformer from '#transformers/organization_member_transformer'
import RoleTransformer from '#transformers/role_transformer'
import Role from '#models/role'
import { LastOwnerException } from '#exceptions/organization_errors'
import type Organization from '#models/organization'
import type User from '#models/user'

/**
 * Gestion des membres de l'organisation courante (liste, changement de
 * rôle, retrait). Réservé à `canManageMembers` (owner/admin), y compris
 * pour la simple lecture de la liste.
 */
@inject()
export default class OrganizationMembersController {
  constructor(private service: OrganizationMembersService) {}

  /**
   * Écran listant les membres de l'organisation courante.
   */
  async index({ auth, bouncer, inertia }: HttpContext) {
    const org = await this.currentOrganization(auth.getUserOrFail())
    await bouncer.authorize('canManageMembers', org)

    const [members, roles] = await Promise.all([this.service.listMembers(org.id), Role.all()])

    return inertia.render('organization/members', {
      members: members.map((member) => new OrganizationMemberTransformer(member).toObject()),
      roles: roles.map((role) => new RoleTransformer(role).toObject()),
      canManageMembers: true,
    })
  }

  /**
   * Change le rôle d'un membre.
   */
  async update({ auth, bouncer, request, response, params, i18n, session }: HttpContext) {
    const org = await this.currentOrganization(auth.getUserOrFail())
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
    const org = await this.currentOrganization(auth.getUserOrFail())
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

  /**
   * Charge l'organisation courante de l'utilisateur (relation, pas de
   * `Model.query()` en controller). 403 si absente.
   */
  private async currentOrganization(user: User): Promise<Organization> {
    await user.load('currentOrganization')
    if (!user.currentOrganization) {
      throw new Exception('No current organization', { status: 403, code: 'E_NO_CURRENT_ORG' })
    }
    return user.currentOrganization
  }
}
