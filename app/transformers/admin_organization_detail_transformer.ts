import { BaseTransformer } from '@adonisjs/core/transformers'
import AdminOrganizationTransformer from '#transformers/admin_organization_transformer'
import type { AdminOrganizationDetails } from '#services/admin_organization_service'
import type { AdminOrganizationDetail } from '#shared/types/admin'

/**
 * Fiche d'une organisation du back-office : colonnes de la liste + contact,
 * identifiants légaux, volumes et membres avec leur rôle.
 */
export default class AdminOrganizationDetailTransformer extends BaseTransformer<AdminOrganizationDetails> {
  toObject(): AdminOrganizationDetail {
    const { organization, members, productsCount, rfqsCount } = this.resource

    return {
      ...new AdminOrganizationTransformer(organization).toObject(),
      ...this.pick(organization, ['email', 'phone', 'website', 'siret', 'vatNumber']),
      productsCount,
      rfqsCount,
      members: members.map((membership) => ({
        id: membership.user.id,
        email: membership.user.email,
        fullName: membership.user.fullName,
        roleSlug: membership.role.slug as AdminOrganizationDetail['members'][number]['roleSlug'],
        joinedAt: membership.joinedAt.toISO()!,
      })),
    }
  }
}
