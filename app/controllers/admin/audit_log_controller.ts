import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdminAuditService from '#services/admin_audit_service'
import AdminAuditLogTransformer from '#transformers/admin_audit_log_transformer'
import { auditFiltersValidator } from '#validators/admin_audit'
import type { AdminAuditFilters } from '#shared/types/admin_audit'

const PER_PAGE = 50

/**
 * Consultation du journal d'audit du back-office (droit `audit.view`), la plus
 * récente entrée d'abord, filtrable par action, cible, acteur et période.
 */
@inject()
export default class AuditLogController {
  constructor(private service: AdminAuditService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'audit.view')

    const query = await request.validateUsing(auditFiltersValidator, {
      data: request.qs(),
    })
    const filters: AdminAuditFilters = {
      action: query.action ?? null,
      targetType: query.targetType ?? null,
      actor: query.actor || null,
      from: query.from ?? null,
      to: query.to ?? null,
    }

    const paginator = await this.service.list({
      ...filters,
      page: query.page ?? 1,
      perPage: PER_PAGE,
    })

    return inertia.render('admin/audit/index', {
      entries: {
        data: paginator.all().map((entry) => new AdminAuditLogTransformer(entry).toObject()),
        meta: {
          total: paginator.total,
          perPage: paginator.perPage,
          currentPage: paginator.currentPage,
          lastPage: paginator.lastPage,
        },
      },
      filters,
    })
  }
}
