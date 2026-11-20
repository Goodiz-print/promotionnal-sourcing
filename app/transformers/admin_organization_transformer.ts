import type Organization from '#models/organization'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { AdminOrganizationListItem } from '#shared/types/admin_organization'
import type { QuoteAddressSource } from '#shared/types/rfq'
import { SUPPLIER_ORGANIZATION_KINDS } from '#shared/types/organization'
import { quoteAddressSource } from '#shared/helpers/quote_address'

/**
 * Ligne de la liste des organisations du back-office (nombre de membres via
 * `withCount` -> `$extras.members_count`).
 */
export default class AdminOrganizationTransformer extends BaseTransformer<Organization> {
  toObject(): AdminOrganizationListItem {
    return {
      ...this.pick(this.resource, ['id', 'name', 'slug', 'organizationType', 'country']),
      membersCount: Number(this.resource.$extras.members_count ?? 0),
      archivedAt: this.resource.archivedAt?.toISO() ?? null,
      createdAt: this.resource.createdAt.toISO()!,
      // lastActivity est calcule separement pour la liste (sous-requete) ou dans les details
      lastActivity: this.resource.$extras.last_activity
        ? new Date(this.resource.$extras.last_activity).toISOString()
        : null,
      quoteAddressSource: this.quoteAddressSource(),
    }
  }

  /**
   * Suppose `supplierProfile` préchargé (`AdminOrganizationService#list`) ;
   * `null` pour une organisation qui ne vend pas.
   */
  private quoteAddressSource(): QuoteAddressSource | null {
    if (!SUPPLIER_ORGANIZATION_KINDS.includes(this.resource.organizationType)) return null
    return quoteAddressSource({
      quoteEmail: this.resource.supplierProfile?.quoteEmail ?? null,
      organizationEmail: this.resource.email,
    })
  }
}
