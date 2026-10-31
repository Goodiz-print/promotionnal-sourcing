import type AdminAuditLog from '#models/admin_audit_log'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { AdminAuditLogItem } from '#shared/types/admin_audit'

/**
 * Ligne du journal d'audit du back-office.
 */
export default class AdminAuditLogTransformer extends BaseTransformer<AdminAuditLog> {
  toObject(): AdminAuditLogItem {
    return {
      ...this.pick(this.resource, [
        'id',
        'action',
        'actorEmail',
        'targetType',
        'targetId',
        'changes',
        'ipAddress',
      ]),
      createdAt: this.resource.createdAt.toISO()!,
    }
  }
}
