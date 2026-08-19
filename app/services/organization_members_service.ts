import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import {
  LastOwnerException,
  OrganizationMemberNotFoundException,
} from '#exceptions/organization_errors'

/**
 * Gestion des membres d'une organisation (liste, changement de rôle,
 * retrait). Garde en place : une organisation garde toujours au moins un
 * `owner` — on ne peut ni rétrograder ni retirer le dernier.
 */
export default class OrganizationMembersService {
  /**
   * Membres de l'organisation, préchargés avec l'utilisateur et le rôle.
   */
  listMembers(organizationId: number): Promise<OrganizationUser[]> {
    return OrganizationUser.query()
      .where('organizationId', organizationId)
      .preload('user')
      .preload('role')
      .orderBy('joinedAt', 'asc')
  }

  /**
   * Charge un membre de l'organisation par id de pivot, 404 s'il n'existe
   * pas ou appartient à une autre organisation.
   */
  async findMember(organizationId: number, id: number): Promise<OrganizationUser> {
    const member = await OrganizationUser.query()
      .where('id', id)
      .where('organizationId', organizationId)
      .preload('user')
      .preload('role')
      .first()

    if (!member) throw new OrganizationMemberNotFoundException()
    return member
  }

  /**
   * Change le rôle d'un membre. Rejette si le membre est le dernier owner
   * et que le nouveau rôle n'est pas owner.
   */
  async changeRole(member: OrganizationUser, roleId: number): Promise<OrganizationUser> {
    const newRole = await Role.findOrFail(roleId)

    if (newRole.slug !== 'owner' && (await this.isLastOwner(member))) {
      throw new LastOwnerException()
    }

    member.roleId = newRole.id
    await member.save()
    await member.load('role')
    return member
  }

  /**
   * Retire un membre de l'organisation. Rejette si c'est le dernier owner.
   * Si le membre retiré avait cette organisation comme organisation
   * courante, on la réinitialise (il repassera par l'onboarding).
   */
  async removeMember(member: OrganizationUser): Promise<void> {
    if (await this.isLastOwner(member)) {
      throw new LastOwnerException()
    }

    await member.load('user')
    const { user, organizationId } = member
    await member.delete()

    if (user.currentOrganizationId === organizationId) {
      await user.merge({ currentOrganizationId: null }).save()
    }
  }

  private async isLastOwner(member: OrganizationUser): Promise<boolean> {
    await member.load('role')
    if (member.role.slug !== 'owner') return false

    const result = await OrganizationUser.query()
      .where('organizationId', member.organizationId)
      .whereHas('role', (query) => query.where('slug', 'owner'))
      .count('* as total')

    return Number(result[0].$extras.total) <= 1
  }
}
