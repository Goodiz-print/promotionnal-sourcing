import factory from '@adonisjs/lucid/factories'
import AdminAuditLog from '#models/admin_audit_log'

export const AdminAuditLogFactory = factory
  .define(AdminAuditLog, ({ faker }) => ({
    actorEmail: faker.internet.email().toLowerCase(),
    action: 'platform_role.changed' as const,
    targetType: 'user' as const,
    targetId: faker.number.int({ min: 1, max: 10_000 }),
    changes: { before: { platformRole: 'none' }, after: { platformRole: 'admin' } },
    ipAddress: '127.0.0.1',
  }))
  .build()
