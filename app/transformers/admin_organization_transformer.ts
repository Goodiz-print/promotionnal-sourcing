import type Organization from '#models/organization'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { AdminOrganizationListItem } from '#shared/types/admin'

/**
 * Ligne de la liste des organisations du back-office (nombre de membres via
 * `withCount` → `$extras.members_count`).
 */
export default class AdminOrganizationTransformer extends BaseTransformer<Organization> {
  toObject(): AdminOrganizationListItem {
    return {
      ...this.pick(this.resource, ['id', 'name', 'slug', 'organizationType', 'country']),
      membersCount: Number(this.resource.$extras.members_count ?? 0),
      archivedAt: this.resource.archivedAt?.toISO() ?? null,
      createdAt: this.resource.createdAt.toISO()!,
    }
  }
}
