import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { AdminAuditLogSchema } from '#database/schema'
import User from '#models/user'
import type {
  AdminAuditAction,
  AdminAuditChanges,
  AdminAuditTargetType,
} from '#shared/types/admin_audit'

/**
 * Une entrée du journal d'audit du back-office. En ajout seul : aucune colonne
 * `updated_at`, et `AdminAuditService` n'expose ni mise à jour ni suppression.
 */
export default class AdminAuditLog extends AdminAuditLogSchema {
  static table = 'admin_audit_logs'

  declare action: AdminAuditAction
  declare targetType: AdminAuditTargetType | null
  declare changes: AdminAuditChanges | null

  @belongsTo(() => User, { foreignKey: 'actorUserId' })
  declare actor: BelongsTo<typeof User>
}
