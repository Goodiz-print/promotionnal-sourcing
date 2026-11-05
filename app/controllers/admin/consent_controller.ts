import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminConsentService from '#services/admin_consent_service'
import {
  adminConsentExportValidator,
  adminConsentFiltersValidator,
} from '#validators/admin_consent'
import type { AdminConsentFilters } from '#shared/types/admin_consent'

const PER_PAGE = 50

/**
 * Consentements légaux (#168) : preuves de CGU, licences et autorisations.
 * Données personnelles (IP, email) : réservé au droit `audit.view` (admin).
 */
@inject()
export default class ConsentController {
  constructor(private service: AdminConsentService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'audit.view')

    const query = await request.validateUsing(adminConsentFiltersValidator, {
      data: request.qs(),
    })
    const filters: AdminConsentFilters = {
      organization: query.organization ?? null,
      user: query.user ?? null,
      kind: query.kind ?? null,
      version: query.version ?? null,
      outdated: query.outdated ?? false,
    }

    return inertia.render('admin/consents/index', {
      consents: await this.service.list({ ...filters, page: query.page ?? 1, perPage: PER_PAGE }),
      overview: await this.service.overview(),
      filters,
    })
  }

  /** Export CSV de la preuve d'une organisation (tracé dans l'audit). */
  async export(ctx: HttpContext) {
    const { bouncer, request, response, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'audit.view')

    const { organizationId } = await request.validateUsing(adminConsentExportValidator, {
      data: request.qs(),
    })
    const { filename, csv } = await this.service.exportCsv(
      organizationId,
      [
        i18n.t('admin.consents.columns.id'),
        i18n.t('admin.consents.columns.kind'),
        i18n.t('admin.consents.columns.version'),
        i18n.t('admin.consents.columns.acceptedAt'),
        i18n.t('admin.consents.columns.revokedAt'),
        i18n.t('admin.consents.columns.ip'),
        i18n.t('admin.consents.columns.user'),
      ],
      adminActionContext(ctx)
    )

    response.header('Content-Type', 'text/csv; charset=utf-8')
    response.header('Content-Disposition', `attachment; filename="${filename}"`)
    return response.send(csv)
  }
}
