import type OrganizationUser from '#models/organization_user'
import RoleTransformer from '#transformers/role_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { OrganizationSummaryType } from '#shared/types/organization'

/**
 * Adhésion → organisation résumée pour le sélecteur d'organisation. Attend
 * `organization` et `role` préchargés (cf.
 * `OrganizationContextService#membershipsFor`).
 */
export default class OrganizationSummaryTransformer extends BaseTransformer<OrganizationUser> {
  toObject(): OrganizationSummaryType {
    const { organization } = this.resource

    return {
      ...this.pick(organization, ['id', 'name', 'slug', 'logoUrl']),
      role: new RoleTransformer(this.resource.role).toObject(),
    }
  }
}
