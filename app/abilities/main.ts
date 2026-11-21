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
import type QuoteDocument from '#models/quote_document'
import type Rfq from '#models/rfq'
import type RfqSupplier from '#models/rfq_supplier'
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
 * Ability to check if a user can manage the sponsored-product campaigns and the
 * ad wallet of an organization (it spends the organization's money).
 * The organization must be a supplier (or both), and the user an owner/admin.
 */
export const canManageAds = Bouncer.ability(async (user: User, org: Organization) => {
  if (!['supplier', 'both'].includes(org.organizationType)) return false
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin'].includes(m.role.slug) : false
})

/**
 * Ability to check if a user can subscribe, change or cancel the paid plan of an
 * organization (it commits the organization to a recurring payment).
 * The organization must be a supplier (or both), and the user an owner/admin.
 */
export const canManageSubscription = Bouncer.ability(async (user: User, org: Organization) => {
  if (!['supplier', 'both'].includes(org.organizationType)) return false
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin'].includes(m.role.slug) : false
})

/**
 * Ability to check if a user belongs to a supplier organization **without** the
 * right to manage its subscription (any role but owner/admin). Such a member,
 * coming from the subscription upsell of an anonymous request mail (#222), is
 * sent back with an explanation instead of a 403. Mirror of
 * `canManageSubscription` for supplier members.
 */
export const isSupplierMemberWithoutSubscriptionRights = Bouncer.ability(
  async (user: User, org: Organization) => {
    if (!['supplier', 'both'].includes(org.organizationType)) return false
    const m = await getMembership(user, org)
    return m ? !['owner', 'admin'].includes(m.role.slug) : false
  }
)

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
 * Ability to check if a user can prepare and send an RFQ: edit a draft, add or
 * remove recipients, publish, send it to suppliers, check out the quote cart
 * (#216). Every member of a buyer organization may request quotes, `member`
 * included (client decision): aligned on `sourcing:create`, like `canCreateRfq`.
 */
export const canSendRfq = Bouncer.ability(async (user: User, org: Organization) => {
  if (!['buyer', 'both'].includes(org.organizationType)) return false
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin', 'manager', 'member'].includes(m.role.slug) : false
})

/**
 * Ability to check if a user can take decisions on an RFQ: close it, extend its
 * deadline, accept or reject a quote, act on an order. Aligned on the
 * `sourcing:manage` permission: `member` may send requests (`canSendRfq`), but
 * decisions stay with the organization's managers.
 */
export const canManageRfq = Bouncer.ability(async (user: User, org: Organization) => {
  if (!['buyer', 'both'].includes(org.organizationType)) return false
  const m = await getMembership(user, org)
  return m ? ['owner', 'admin', 'manager'].includes(m.role.slug) : false
})

/**
 * Ability to check if a user can download a quote PDF received by email (#225):
 * any member of the agency that owns the request, whatever their role — the
 * same people who can open the request (`canCreateRfq`). The supplier side and
 * other organizations are refused. Expects `document.rfq` preloaded
 * (`QuoteService#findDocument`).
 */
export const canDownloadQuoteDocument = Bouncer.ability(
  async (user: User, document: QuoteDocument) => {
    const membership = await OrganizationUser.query()
      .where('user_id', user.id)
      .where('organization_id', document.rfq.buyerOrganizationId)
      .select('id')
      .first()
    return membership !== null
  }
)

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

/**
 * Ability to check if a user can write, as the agency, in the thread of an RFQ
 * recipient (#226): any member of the agency that owns the request, whatever
 * their role — the same people who can open it (`canCreateRfq`) — once the
 * request was sent to this supplier (a `pending` recipient has no thread yet).
 * The message is then relayed to the supplier by email.
 */
export const canMessageRfqSupplier = Bouncer.ability(
  async (user: User, rfq: Rfq, recipient: RfqSupplier) => {
    if (recipient.rfqId !== rfq.id || recipient.status === 'pending') return false
    const membership = await OrganizationUser.query()
      .where('user_id', user.id)
      .where('organization_id', rfq.buyerOrganizationId)
      .select('id')
      .first()
    return membership !== null
  }
)

/**
 * Ability to check if a user can write, as the supplier, in the thread of a
 * received RFQ (#226): the members who can answer it (`RFQ_RESPONDER_ROLES`,
 * like `canRespondToRfq`) of the recipient organization, once the request was
 * sent. The message is then relayed to the agency by email.
 */
export const canMessageRfqBuyer = Bouncer.ability(async (user: User, recipient: RfqSupplier) => {
  if (recipient.status === 'pending') return false
  const membership = await OrganizationUser.query()
    .where('user_id', user.id)
    .where('organization_id', recipient.supplierOrganizationId)
    .preload('role')
    .first()
  return membership ? RFQ_RESPONDER_ROLES.includes(membership.role.slug as RoleSlug) : false
})
