import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminQueueService from '#services/admin_queue_service'
import { adminQueueFiltersValidator } from '#validators/admin_queue'
import { QUEUE_JOB_FILTER_STATUSES, type AdminQueueFilters } from '#shared/types/admin_queue'

const PER_PAGE = 25

/**
 * Supervision de la queue (#175), droit `queue.manage` (admin) : les charges
 * utiles des jobs peuvent contenir des données personnelles. Controller fin :
 * droit, validation, puis `AdminQueueService`.
 */
@inject()
export default class QueueController {
  constructor(private service: AdminQueueService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'queue.manage')

    const query = await request.validateUsing(adminQueueFiltersValidator, {
      data: request.qs(),
    })
    const filters: AdminQueueFilters = {
      status: query.status ?? null,
      name: query.name ?? null,
    }

    return inertia.render('admin/queue/index', {
      overview: await this.service.overview(),
      jobs: await this.service.list({ ...filters, page: query.page ?? 1, perPage: PER_PAGE }),
      filters,
      statuses: [...QUEUE_JOB_FILTER_STATUSES],
    })
  }

  async show({ bouncer, inertia, params }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'queue.manage')

    return inertia.render('admin/queue/show', {
      job: await this.service.show(params.queue, params.id),
    })
  }

  /** Remet un job échoué en file. */
  async retry(ctx: HttpContext) {
    const { bouncer, params, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'queue.manage')

    const done = await this.service.retry(params.queue, params.id, adminActionContext(ctx))
    session.flash(
      done ? 'success' : 'error',
      i18n.t(done ? 'admin.queue.flash.retried' : 'admin.queue.flash.notRetryable')
    )
    return response.redirect().toRoute('admin.queue.index', { locale: i18n.locale })
  }

  /** Supprime un job en attente, différé ou échoué. */
  async cancel(ctx: HttpContext) {
    const { bouncer, params, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'queue.manage')

    const done = await this.service.cancel(params.queue, params.id, adminActionContext(ctx))
    session.flash(
      done ? 'success' : 'error',
      i18n.t(done ? 'admin.queue.flash.cancelled' : 'admin.queue.flash.notCancellable')
    )
    return response.redirect().toRoute('admin.queue.index', { locale: i18n.locale })
  }

  /** Lance un job planifié hors de son horaire. */
  async runSchedule(ctx: HttpContext) {
    const { bouncer, params, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'queue.manage')

    const done = await this.service.runSchedule(params.id, adminActionContext(ctx))
    session.flash(
      done ? 'success' : 'error',
      i18n.t(done ? 'admin.queue.flash.scheduleRun' : 'admin.queue.flash.notRunnable')
    )
    return response.redirect().toRoute('admin.queue.index', { locale: i18n.locale })
  }
}
