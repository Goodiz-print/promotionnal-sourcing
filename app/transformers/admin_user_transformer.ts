import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { AdminUserListItem } from '#shared/types/admin'

/**
 * Ligne de la liste des utilisateurs du back-office (nombre d'organisations via
 * `withCount` → `$extras.organizations_count`). Jamais de mot de passe.
 */
export default class AdminUserTransformer extends BaseTransformer<User> {
  toObject(): AdminUserListItem {
    return {
      ...this.pick(this.resource, ['id', 'email', 'fullName', 'platformRole']),
      emailVerified: this.resource.emailVerifiedAt !== null,
      organizationsCount: Number(this.resource.$extras.organizations_count ?? 0),
      createdAt: this.resource.createdAt.toISO()!,
    }
  }
}
