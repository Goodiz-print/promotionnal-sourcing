/*
|--------------------------------------------------------------------------
| Bouncer abilities
|--------------------------------------------------------------------------
|
| You may export multiple abilities from this file and pre-register them
| when creating the Bouncer instance.
|
| Pre-registered policies and abilities can be referenced as a string by their
| name. Also they are must if want to perform authorization inside Edge
| templates.
|
*/

import { Bouncer } from '@adonisjs/bouncer'
import type User from '#models/user'
import type Organization from '#models/organization'
import OrganizationUser from '#models/organization_user'

/**
 * Ability to check if user is authenticated
 */
export const isAuthenticated = Bouncer.ability((user: User | null) => {
  return !!user
})

/**
 * Ability to check if user can edit their own profile.
 * Can be extended to check a `role` field when added to the User model.
 *
 * @example Add a role field to users table:
 * ```ts
 * // In migration
 * table.string('role').notNullable().defaultTo('user')
 *
 * // Then update this ability:
 * export const adminAbility = Bouncer.ability((user: User) => {
 *   return user.role === 'admin'
 * })
 * ```
 */
export const editOwnProfile = Bouncer.ability((user: User, targetUserId: number) => {
  return user.id === targetUserId
})

/**
 * Helper function to get user membership in an organization
 */
async function getMembership(user: User, org: Organization) {
  return OrganizationUser.query()
    .where('user_id', user.id)
    .where('organization_id', org.id)
    .preload('role')
    .first()
}

/**
 * Ability to check if user can manage organization settings
 * Allowed roles: owner, admin
 */
export const canManageOrganization = Bouncer.ability(async (user: User, org: Organization) => {
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin'].includes(m.role.slug) : false
})

/**
 * Ability to check if user can invite members to an organization
 * Allowed roles: owner, admin, manager
 */
export const canInviteMembers = Bouncer.ability(async (user: User, org: Organization) => {
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin', 'manager'].includes(m.role.slug) : false
})

/**
 * Ability to check if user can manage organization members (edit/remove)
 * Allowed roles: owner, admin
 */
export const canManageMembers = Bouncer.ability(async (user: User, org: Organization) => {
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin'].includes(m.role.slug) : false
})

/**
 * Ability to check if user can manage the supplier profile of an organization.
 * The organization must be a supplier (or both), and the user an owner/admin.
 */
export const canManageSupplierProfile = Bouncer.ability(async (user: User, org: Organization) => {
  if (!['supplier', 'both'].includes(org.organizationType)) return false
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin'].includes(m.role.slug) : false
})

/**
 * Ability to check if a user can manage the products of an organization.
 * The organization must be a supplier (or both), and the user an owner/admin.
 */
export const canManageProducts = Bouncer.ability(async (user: User, org: Organization) => {
  if (!['supplier', 'both'].includes(org.organizationType)) return false
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin'].includes(m.role.slug) : false
})
