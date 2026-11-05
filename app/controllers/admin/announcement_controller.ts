import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminAnnouncementService from '#services/admin_announcement_service'
import {
  adminAnnouncementFiltersValidator,
  adminAnnouncementValidator,
} from '#validators/admin_announcement'
import type { AnnouncementTranslations } from '#shared/types/announcement'
import type { Locale } from '#shared/types/i18n'

const PER_PAGE = 25

/**
 * Annonces plateforme (#169), droit `announcements.manage` (admin) : un envoi
 * touche des utilisateurs de toutes les organisations. Controller fin : droit,
 * validation, puis `AdminAnnouncementService`.
 */
@inject()
export default class AnnouncementController {
  constructor(private service: AdminAnnouncementService) {}

  /** Historique des annonces émises, avec leur taux de lecture. */
  async index({ bouncer, inertia, request, i18n }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'announcements.manage')

    const query = await request.validateUsing(adminAnnouncementFiltersValidator, {
      data: request.qs(),
    })

    return inertia.render('admin/announcements/index', {
      announcements: await this.service.list({
        page: query.page ?? 1,
        perPage: PER_PAGE,
        locale: i18n.locale as Locale,
      }),
    })
  }

  async create({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'announcements.manage')

    return inertia.render('admin/announcements/create', {
      audienceSizes: await this.service.audienceSizes(),
    })
  }

  async store(ctx: HttpContext) {
    const { bouncer, request, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'announcements.manage')

    const payload = await request.validateUsing(adminAnnouncementValidator)
    const translations: AnnouncementTranslations = {
      fr: { title: payload.titleFr, body: payload.bodyFr },
    }
    if (payload.titleEn && payload.bodyEn) {
      translations.en = { title: payload.titleEn, body: payload.bodyEn }
    }

    await this.service.create(
      {
        audience: payload.audience,
        organizationId: payload.organizationId ?? null,
        sendInApp: payload.channels.includes('inApp'),
        sendEmail: payload.channels.includes('email'),
        translations,
      },
      adminActionContext(ctx)
    )

    session.flash('success', i18n.t('admin.announcements.flash.queued'))
    return response.redirect().toRoute('admin.announcements.index', { locale: i18n.locale })
  }
}
