import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminStorageService from '#services/admin_storage_service'

/**
 * Supervision du stockage Cellar (#178), droit `ops.manage` (admin). Controller
 * fin : droit, puis `AdminStorageService`.
 */
@inject()
export default class StorageController {
  constructor(private service: AdminStorageService) {}

  async index({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    return inertia.render('admin/storage/index', { overview: await this.service.overview() })
  }

  /** Relance la reprise des envois interrompus et des purges perdues. */
  async recover(ctx: HttpContext) {
    const { bouncer, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    await this.service.requestRecovery(adminActionContext(ctx))
    session.flash('success', i18n.t('admin.storage.flash.recoveryQueued'))
    return response.redirect().toRoute('admin.storage.index', { locale: i18n.locale })
  }
}
