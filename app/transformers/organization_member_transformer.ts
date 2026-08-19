import type OrganizationUser from '#models/organization_user'
import type { OrganizationMemberType } from '#shared/types/organization'
import RoleTransformer from '#transformers/role_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * Transforme un pivot `OrganizationUser` (préchargé avec `user` et `role`)
 * en DTO membre exposé au frontend.
 */
export default class OrganizationMemberTransformer extends BaseTransformer<OrganizationUser> {
  toObject(): OrganizationMemberType {
    return {
      id: this.resource.id,
      fullName: this.resource.user.fullName,
      email: this.resource.user.email,
      role: new RoleTransformer(this.resource.role).toObject(),
      joinedAt: this.resource.joinedAt.toISO()!,
    }
  }
}
