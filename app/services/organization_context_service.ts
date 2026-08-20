import type Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import type User from '#models/user'
import {
  NoCurrentOrganizationException,
  NotAMemberException,
  OrganizationArchivedException,
} from '#exceptions/organization_errors'

/**
 * Contexte d'organisation d'un utilisateur : quelle organisation est la
 * courante, à quelles organisations il appartient encore, et sur laquelle
 * basculer quand la courante disparaît (départ, retrait par un admin,
 * archivage).
 *
 * Service **sans dépendance**, volontairement séparé d'`OrganizationService` :
 * il est consommé à la fois par les controllers (organisation courante), par
 * `OrganizationMembersService` (retrait d'un membre) et par
 * `OrganizationService` (départ, archivage) — le sortir évite un cycle
 * d'injection entre ces deux derniers.
 */
export default class OrganizationContextService {
  /**
   * Organisation courante de l'utilisateur. Remplace le helper privé qui était
   * dupliqué dans six controllers. Une organisation archivée n'est jamais
   * considérée comme courante.
   */
  async currentFor(user: User): Promise<Organization> {
    await user.load('currentOrganization')
    const organization = user.currentOrganization

    if (!organization || organization.archivedAt) throw new NoCurrentOrganizationException()
    return organization
  }

  /**
   * Adhésions de l'utilisateur aux organisations **vivantes** (non archivées),
   * organisation et rôle préchargés, dans l'ordre d'ancienneté. Sert autant au
   * sélecteur d'organisation qu'au calcul de l'organisation de repli.
   */
  membershipsFor(user: User): Promise<OrganizationUser[]> {
    return OrganizationUser.query()
      .where('userId', user.id)
      .whereHas('organization', (query) => query.whereNull('archivedAt'))
      .preload('organization')
      .preload('role')
      .orderBy('joinedAt', 'asc')
  }

  /**
   * Première organisation vivante sur laquelle l'utilisateur peut retomber,
   * `null` s'il n'en a plus aucune (→ onboarding).
   */
  async fallbackFor(
    user: User,
    excludingOrganizationId?: number
  ): Promise<Organization | undefined> {
    const memberships = await this.membershipsFor(user)
    return memberships.find((membership) => membership.organizationId !== excludingOrganizationId)
      ?.organization
  }

  /**
   * À appeler après avoir retiré l'utilisateur d'une organisation : si c'était
   * sa courante, il bascule sur une autre adhésion, sinon `null` (le middleware
   * `onboarded` le renverra vers l'onboarding). Sans effet si l'organisation
   * quittée n'était pas la courante.
   */
  async reassignCurrentOrganization(user: User, leavingOrganizationId: number): Promise<void> {
    if (user.currentOrganizationId !== leavingOrganizationId) return

    const fallback = await this.fallbackFor(user, leavingOrganizationId)
    await user.merge({ currentOrganizationId: fallback?.id ?? null }).save()
  }

  /**
   * Bascule explicite (sélecteur d'organisation). Rejette une organisation dont
   * l'utilisateur n'est pas membre, ou archivée.
   */
  async switchTo(user: User, organizationId: number): Promise<Organization> {
    const membership = await OrganizationUser.query()
      .where('userId', user.id)
      .where('organizationId', organizationId)
      .preload('organization')
      .first()

    if (!membership) throw new NotAMemberException()
    if (membership.organization.archivedAt) throw new OrganizationArchivedException()

    await user.merge({ currentOrganizationId: organizationId }).save()
    return membership.organization
  }

  /**
   * Garantit que l'organisation courante est utilisable — adhésion toujours
   * valide **et** organisation non archivée — en basculant silencieusement sur
   * une autre adhésion le cas échéant. Retourne `false` quand il n'en reste
   * aucune : l'appelant (middleware `onboarded`) renvoie alors vers
   * l'onboarding.
   */
  async ensureUsableOrganization(user: User): Promise<boolean> {
    const memberships = await this.membershipsFor(user)
    const isCurrentUsable = memberships.some(
      (membership) => membership.organizationId === user.currentOrganizationId
    )
    if (isCurrentUsable) return true

    const fallbackId = memberships[0]?.organizationId ?? null
    await user.merge({ currentOrganizationId: fallbackId }).save()
    return fallbackId !== null
  }
}
