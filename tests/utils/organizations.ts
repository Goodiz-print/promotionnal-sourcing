import { DateTime } from 'luxon'
import { OrganizationFactory } from '#database/factories/organization_factory'
import { OrganizationSubscriptionFactory } from '#database/factories/organization_subscription_factory'
import { UserFactory } from '#database/factories/user_factory'
import Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'
import Role from '#models/role'
import User from '#models/user'
import type { RoleSlug } from '#shared/types/role'

interface JoinOptions {
  /**
   * Fait de l'organisation rejointe l'organisation **courante** de
   * l'utilisateur (défaut). Passer `false` pour un membre qui travaille
   * ailleurs — utile pour vérifier qu'un écran liste bien tous les membres.
   */
  asCurrent?: boolean
}

/**
 * Rattache un utilisateur existant à une organisation avec le rôle demandé.
 * `joinedAt` est toujours renseigné : plusieurs specs l'omettaient et s'en
 * remettaient au défaut de la base.
 */
export async function joinOrganization(
  user: User,
  organization: Organization,
  roleSlug: RoleSlug = 'member',
  { asCurrent = true }: JoinOptions = {}
): Promise<OrganizationUser> {
  const role = await Role.findByOrFail('slug', roleSlug)
  const membership = await OrganizationUser.create({
    userId: user.id,
    organizationId: organization.id,
    roleId: role.id,
    joinedAt: DateTime.now(),
  })

  if (asCurrent) {
    await user.merge({ currentOrganizationId: organization.id }).save()
  }

  return membership
}

/**
 * Crée un utilisateur **et** son adhésion à l'organisation : le geste le plus
 * courant des specs. `overrides` sert quand une assertion porte sur l'email ou
 * le nom (sinon, laisser la factory générer).
 */
export async function createMember(
  organization: Organization,
  roleSlug: RoleSlug = 'member',
  overrides: Partial<{ email: string; firstName: string; lastName: string }> = {},
  options: JoinOptions = {}
): Promise<User> {
  const user = await UserFactory.merge(overrides).create()
  await joinOrganization(user, organization, roleSlug, options)
  return user
}

/**
 * Organisation + son `owner`, en une ligne — l'ouverture de la plupart des
 * scénarios.
 */
export async function createOrganizationWithOwner(
  overrides: Partial<{ name: string; slug: string }> = {},
  ownerOverrides: Partial<{ email: string; firstName: string; lastName: string }> = {}
): Promise<{ organization: Organization; owner: User }> {
  const organization = await OrganizationFactory.merge(overrides).create()
  const owner = await createMember(organization, 'owner', ownerOverrides)
  return { organization, owner }
}

/**
 * Propriétaire de démo d'une organisation semée par `DevUserSeeder` (seed
 * `full`), basculé sur cette organisation : `eurogoods-org` (fournisseuse) ou
 * `promotionnal-sourcing` (acheteuse, agence).
 */
export async function seededDevUser(organizationSlug: string): Promise<User> {
  const organization = await Organization.findByOrFail('slug', organizationSlug)
  const ownerRole = await Role.findByOrFail('slug', 'owner')
  const membership = await OrganizationUser.query()
    .where('organization_id', organization.id)
    .where('role_id', ownerRole.id)
    .firstOrFail()
  const user = await User.findOrFail(membership.userId)
  await user.merge({ currentOrganizationId: organization.id }).save()
  return user
}

/**
 * Membre (rôle `member` par défaut) d'une organisation **déjà semée**,
 * désignée par son slug.
 */
export async function createMemberOf(
  organizationSlug: string,
  roleSlug: RoleSlug = 'member'
): Promise<User> {
  const organization = await Organization.findByOrFail('slug', organizationSlug)
  return createMember(organization, roleSlug)
}

/**
 * Abonne l'organisation : abonnement Business manuel **en cours** (cf.
 * `OrganizationSubscriptionFactory`). Renvoyé pour le faire expirer ensuite.
 */
export function subscribeOrganization(organization: Organization) {
  return OrganizationSubscriptionFactory.merge({ organizationId: organization.id }).create()
}
