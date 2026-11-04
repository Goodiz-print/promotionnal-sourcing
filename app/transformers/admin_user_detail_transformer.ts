import type User from '#models/user'
import type LegalConsent from '#models/legal_consent'
import type OrganizationUser from '#models/organization_user'
import type Passkey from '#models/passkey'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type {
  AdminUserDetail,
  AdminUserOrganization,
  AdminUserPasskey,
  AdminUserConsent,
} from '#shared/types/admin_user'
import type { RoleSlug } from '#shared/types/role'
import type { OrganizationKind } from '#shared/types/organization'

/**
 * Fiche complète d'un utilisateur. Transforme les relations préchargées
 * (organisations, passkeys, consentements). Jamais de mot de passe ni de
 * données secrètes de passkey.
 */
export default class AdminUserDetailTransformer extends BaseTransformer<User> {
  constructor(
    resource: User,
    private currentUserId: number,
    private canSupport: boolean,
    private canManage: boolean
  ) {
    super(resource)
  }

  toObject(): AdminUserDetail {
    const user = this.resource
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      civility: user.civility,
      platformRole: user.platformRole,
      emailVerified: user.emailVerifiedAt !== null,
      locale: user.locale,
      createdAt: user.createdAt.toISO()!,
      lastLoginAt: user.lastLoginAt?.toISO() ?? null,
      suspendedAt: user.suspendedAt?.toISO() ?? null,
      organizations: this.transformOrganizations(user.organizationUsers ?? []),
      passkeys: this.transformPasskeys(user.passkeys ?? []),
      consents: this.transformConsents(user.$extras.consents ?? []),
      canSupport: this.canSupport,
      canManage: this.canManage,
      isSelf: user.id === this.currentUserId,
    }
  }

  private transformOrganizations(memberships: OrganizationUser[]): AdminUserOrganization[] {
    return memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      organizationType: membership.organization.organizationType as OrganizationKind,
      roleSlug: membership.role.slug as RoleSlug,
      archivedAt: membership.organization.archivedAt?.toISO() ?? null,
    }))
  }

  private transformPasskeys(passkeys: Passkey[]): AdminUserPasskey[] {
    return passkeys.map((passkey) => ({
      id: passkey.id,
      name: passkey.name,
      createdAt: passkey.createdAt.toISO()!,
      lastUsedAt: passkey.lastUsedAt?.toISO() ?? null,
    }))
  }

  private transformConsents(consents: LegalConsent[]): AdminUserConsent[] {
    return consents.map((consent) => ({
      id: consent.id,
      kind: consent.kind,
      version: consent.version,
      acceptedAt: consent.acceptedAt.toISO()!,
      organizationId: consent.organizationId,
      organizationName: consent.organization?.name ?? null,
    }))
  }
}
