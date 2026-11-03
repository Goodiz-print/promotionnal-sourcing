import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminModerationService from '#services/admin_moderation_service'
import { ModerationTargetNotFoundException } from '#exceptions/moderation_errors'
import {
  moderationDecisionValidator,
  moderationFiltersValidator,
} from '#validators/admin_moderation'
import { MODERATION_TARGET_TYPES, type ModerationTargetType } from '#shared/types/moderation'
import type { AdminModerationFilters } from '#shared/types/admin_moderation'
import type { TranslationLocale } from '#shared/types/i18n'

const PER_PAGE = 25

/**
 * File de modération du back-office (droit `moderation.manage`) : éléments en
 * attente par type et ancienneté, historique d'un élément, décision
 * approuver / rejeter avec motif.
 */
@inject()
export default class ModerationController {
  constructor(private service: AdminModerationService) {}

  async index({ bouncer, inertia, request, i18n }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'moderation.manage')

    const query = await request.validateUsing(moderationFiltersValidator, {
      data: request.qs(),
    })
    const filters: AdminModerationFilters = {
      type: query.type ?? null,
      status: query.status ?? 'pending',
      minAgeDays: query.minAgeDays ?? 0,
    }

    return inertia.render('admin/moderation/index', {
      queue: await this.service.list({
        ...filters,
        page: query.page ?? 1,
        perPage: PER_PAGE,
        locale: i18n.locale as TranslationLocale,
      }),
      filters,
    })
  }

  async show({ bouncer, inertia, params, i18n }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'moderation.manage')
    const targetType = this.targetType(params.type)

    return inertia.render('admin/moderation/show', {
      detail: await this.service.detail(
        targetType,
        Number(params.id),
        i18n.locale as TranslationLocale
      ),
    })
  }

  async decide(ctx: HttpContext) {
    const { bouncer, request, response, params, session, i18n, auth } = ctx
    await bouncer.authorize('hasPlatformPermission', 'moderation.manage')
    const targetType = this.targetType(params.type)

    const { status, reason } = await request.validateUsing(moderationDecisionValidator)
    await this.service.decide({
      targetType,
      targetId: Number(params.id),
      status,
      reason: reason ?? null,
      decidedBy: auth.getUserOrFail(),
      context: adminActionContext(ctx),
    })

    session.flash('success', i18n.t(`admin.moderation.decided.${status}`))
    return response.redirect().back()
  }

  private targetType(value: string): ModerationTargetType {
    if (!(MODERATION_TARGET_TYPES as readonly string[]).includes(value)) {
      throw new ModerationTargetNotFoundException()
    }
    return value as ModerationTargetType
  }
}
