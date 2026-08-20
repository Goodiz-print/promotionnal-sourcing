import type OrganizationInvitation from '#models/organization_invitation'
import type { OrganizationInvitationType } from '#shared/types/organization'
import RoleTransformer from '#transformers/role_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * Transforme une invitation (préchargée avec `role`) en DTO exposé au
 * frontend (liste des invitations en attente).
 */
export default class OrganizationInvitationTransformer extends BaseTransformer<OrganizationInvitation> {
  toObject(): OrganizationInvitationType {
    return {
      id: this.resource.id,
      email: this.resource.email,
      role: new RoleTransformer(this.resource.role).toObject(),
      status: this.resource.status,
      expiresAt: this.resource.expiresAt.toISO()!,
      createdAt: this.resource.createdAt.toISO()!,
    }
  }
}
