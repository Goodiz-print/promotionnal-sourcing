import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminMailService from '#services/admin_mail_service'
import { adminMailFiltersValidator, adminMailRetryAllValidator } from '#validators/admin_mail'
import { ADMIN_MAIL_STATUSES, type AdminMailFilters } from '#shared/types/admin_ops'
import { MAIL_KINDS } from '#shared/types/mail'

const PER_PAGE = 25

/**
 * Supervision des emails (#178), droit `ops.manage` (admin) : les adresses des
 * destinataires et les erreurs SMTP sont des données personnelles. Controller fin :
 * droit, validation, puis `AdminMailService`.
 */
@inject()
export default class MailController {
  constructor(private service: AdminMailService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    const query = await request.validateUsing(adminMailFiltersValidator, { data: request.qs() })
    const filters: AdminMailFilters = { status: query.status ?? null, kind: query.kind ?? null }

    return inertia.render('admin/mail/index', {
      overview: await this.service.overview(),
      deliveries: await this.service.list({ ...filters, page: query.page ?? 1, perPage: PER_PAGE }),
      filters,
      statuses: [...ADMIN_MAIL_STATUSES],
      kinds: Object.values(MAIL_KINDS),
    })
  }

  async show({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    return inertia.render('admin/mail/show', {
      delivery: await this.service.show(Number(params.id)),
    })
  }

  /** Rejoue un mail de la dead-letter. */
  async retry(ctx: HttpContext) {
    const { bouncer, params, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    const result = await this.service.retryOne(Number(params.id), adminActionContext(ctx))
    session.flash(
      result ? 'success' : 'error',
      i18n.t(result ? 'admin.mail.flash.retried' : 'admin.mail.flash.notRetryable')
    )
    return response.redirect().toRoute('admin.mail.index', { locale: i18n.locale })
  }

  /** Rejoue la dead-letter (un type de mail, ou tous). */
  async retryAll(ctx: HttpContext) {
    const { bouncer, request, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    const { kind } = await request.validateUsing(adminMailRetryAllValidator)
    const { requeued, skipped } = await this.service.retryAll(kind ?? null, adminActionContext(ctx))

    if (requeued === 0) session.flash('error', i18n.t('admin.mail.flash.nothingToRetry'))
    else {
      const key =
        skipped > 0 ? 'admin.mail.flash.bulkRetriedSkipped' : 'admin.mail.flash.bulkRetried'
      session.flash('success', i18n.t(key, { count: requeued, skipped }))
    }
    return response.redirect().toRoute('admin.mail.index', { locale: i18n.locale })
  }
}
