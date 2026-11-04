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
import { RFQ_RESPONDER_ROLES } from '#shared/types/rfq'
import type { RoleSlug } from '#shared/types/role'
import { platformRoleHasPermission } from '#shared/helpers/platform_permissions'
import type { PlatformPermission } from '#shared/types/user'

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

/**
 * Ability to check if a user is a **full** platform admin (`users.platform_role
 * = 'admin'`). Orthogonal to organization roles: an `owner` of an ordinary
 * organization is not a platform admin, and a platform admin needs no
 * membership at all. For the finer platform roles (moderator, support, analyst)
 * use `hasPlatformPermission`.
 */
export const isPlatformAdmin = Bouncer.ability((user: User) => {
  return user.isPlatformAdmin
})

/**
 * Ability to check if the user's platform role grants a back-office permission
 * (matrix: `PLATFORM_ROLE_PERMISSIONS` in `shared/types/user.ts`). Every
 * back-office route authorizes a permission, never a role.
 */
export const hasPlatformPermission = Bouncer.ability(
  (user: User, permission: PlatformPermission) => {
    return platformRoleHasPermission(user.platformRole, permission)
  }
)

/**
 * Ability to check if a user can manage the catalogue taxonomy (categories).
 * Categories are a global, platform-level resource: only the platform role
 * granting `catalogue.manage` may create, edit or delete them — never the
 * owner/admin of an organization.
 */
export const canManageCategories = Bouncer.ability((user: User) => {
  return platformRoleHasPermission(user.platformRole, 'catalogue.manage')
})

/**
 * Ability to check if a user can administer the catalogue facets (attributes
 * and attribute values). Global data like the categories: granted by the
 * `catalogue.manage` platform permission (#48).
 */
export const canManageAttributes = Bouncer.ability((user: User) => {
  return platformRoleHasPermission(user.platformRole, 'catalogue.manage')
})

/**
 * Ability to check if a user can administer the certifications reference data
 * (labels de conformité). Global data: granted by the `catalogue.manage`
 * platform permission (#165).
 */
export const canManageCertifications = Bouncer.ability((user: User) => {
  return platformRoleHasPermission(user.platformRole, 'catalogue.manage')
})

/**
 * Ability to check if a user can administer the marking techniques reference
 * data (techniques de marquage). Global data: granted by the `catalogue.manage`
 * platform permission (#165).
 */
export const canManageMarkingTechniques = Bouncer.ability((user: User) => {
  return platformRoleHasPermission(user.platformRole, 'catalogue.manage')
})

/**
 * Ability to check if a user can create a request for quotation (RFQ).
 * The organization must be a buyer (or both). Aligned on the `sourcing:create`
 * permission, granted to every role down to `member`.
 */
export const canCreateRfq = Bouncer.ability(async (user: User, org: Organization) => {
  if (!['buyer', 'both'].includes(org.organizationType)) return false
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin', 'manager', 'member'].includes(m.role.slug) : false
})

/**
 * Ability to check if a user can drive an existing RFQ (edit, publish, send,
 * close). Aligned on the `sourcing:manage` permission: `member` may draft a
 * request, but not send it to suppliers.
 */
export const canManageRfq = Bouncer.ability(async (user: User, org: Organization) => {
  if (!['buyer', 'both'].includes(org.organizationType)) return false
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin', 'manager'].includes(m.role.slug) : false
})

/**
 * Ability to check if a user can answer a received RFQ (view its detail,
 * decline, and — Phase 4 — submit a quote) on behalf of a supplier
 * organization.
 */
export const canRespondToRfq = Bouncer.ability(async (user: User, org: Organization) => {
  if (!['supplier', 'both'].includes(org.organizationType)) return false
  const m = await getMembership(user, org)
  return m ? RFQ_RESPONDER_ROLES.includes(m.role.slug as RoleSlug) : false
})
