import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminImportService from '#services/admin_import_service'
import { adminImportFiltersValidator } from '#validators/admin_import'
import type { AdminImportFilters } from '#shared/types/admin_import'
import { IMPORT_KINDS, IMPORT_STATUSES } from '#shared/types/import_job'

const PER_PAGE = 25

/**
 * Suivi des imports en masse (#170), droit `imports.manage` (admin) : les erreurs
 * reprennent des valeurs saisies par les fournisseurs. Controller fin : droit,
 * validation, puis `AdminImportService`.
 */
@inject()
export default class ImportController {
  constructor(private service: AdminImportService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'imports.manage')

    const query = await request.validateUsing(adminImportFiltersValidator, {
      data: request.qs(),
    })
    const filters: AdminImportFilters = {
      status: query.status ?? null,
      kind: query.kind ?? null,
      organization: query.organization ?? null,
    }

    return inertia.render('admin/imports/index', {
      imports: await this.service.list({ ...filters, page: query.page ?? 1, perPage: PER_PAGE }),
      filters,
      statuses: [...IMPORT_STATUSES],
      kinds: [...IMPORT_KINDS],
    })
  }

  async show({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'imports.manage')

    return inertia.render('admin/imports/show', {
      importJob: await this.service.show(Number(params.id)),
    })
  }

  /** Relance un import échoué ou perdu : crée un nouvel import et ouvre sa fiche. */
  async retry(ctx: HttpContext) {
    const { bouncer, params, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'imports.manage')

    const newId = await this.service.retry(Number(params.id), adminActionContext(ctx))
    if (newId === null) {
      session.flash('error', i18n.t('admin.imports.flash.notRetryable'))
      return response.redirect().toRoute('admin.imports.show', {
        locale: i18n.locale,
        id: params.id,
      })
    }
    session.flash('success', i18n.t('admin.imports.flash.retried'))
    return response.redirect().toRoute('admin.imports.show', { locale: i18n.locale, id: newId })
  }

  /** Export CSV des erreurs conservées (tracé dans l'audit). */
  async errors(ctx: HttpContext) {
    const { bouncer, params, response } = ctx
    await bouncer.authorize('hasPlatformPermission', 'imports.manage')

    const { filename, csv } = await this.service.errorsCsv(
      Number(params.id),
      adminActionContext(ctx)
    )
    response.header('Content-Type', 'text/csv; charset=utf-8')
    response.header('Content-Disposition', `attachment; filename="${filename}"`)
    return response.send(csv)
  }
}
