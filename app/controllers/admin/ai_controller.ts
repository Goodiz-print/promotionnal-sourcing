import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminAiService from '#services/admin_ai_service'
import {
  adminAiBackfillValidator,
  adminAiCorrectionValidator,
  adminAiTranslationFiltersValidator,
} from '#validators/admin_ai'
import {
  AI_TRANSLATIONS_PER_PAGE,
  AI_TRANSLATION_ORIGINS,
  type AdminAiTranslationFilters,
} from '#shared/types/admin_ai'
import { TRANSLATABLE_ENTITIES } from '#shared/types/ai'
import { TRANSLATION_LOCALES } from '#shared/types/i18n'

/**
 * IA et traductions (#177), droit `ai.manage` (admin) : tableau de bord du
 * fournisseur IA, rattrapage des traductions et relecture des traductions
 * automatiques. Controller fin : droit, validation, puis `AdminAiService`.
 */
@inject()
export default class AiController {
  constructor(private service: AdminAiService) {}

  async index({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'ai.manage')

    return inertia.render('admin/ai/index', {
      overview: await this.service.overview(),
      entities: [...TRANSLATABLE_ENTITIES],
    })
  }

  /** Lance le rattrapage des traductions (traité par la queue). */
  async backfill(ctx: HttpContext) {
    const { bouncer, request, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'ai.manage')

    const { entity } = await request.validateUsing(adminAiBackfillValidator)
    const result = await this.service.requestBackfill(entity, adminActionContext(ctx))

    if (result === 'queued') session.flash('success', i18n.t('admin.ai.flash.backfillQueued'))
    else session.flash('error', i18n.t(`admin.ai.flash.backfill.${result}`))
    return response.redirect().back()
  }

  async translations({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'ai.manage')

    const query = await request.validateUsing(adminAiTranslationFiltersValidator, {
      data: request.qs(),
    })
    const filters: AdminAiTranslationFilters = {
      entity: query.entity ?? 'product',
      locale: query.locale ?? null,
      origin: query.origin ?? 'auto',
      search: query.search ?? null,
    }

    return inertia.render('admin/ai/translations', {
      reviews: await this.service.translations({
        ...filters,
        page: query.page ?? 1,
        perPage: AI_TRANSLATIONS_PER_PAGE,
      }),
      filters,
      entities: [...TRANSLATABLE_ENTITIES],
      locales: [...TRANSLATION_LOCALES],
      origins: [...AI_TRANSLATION_ORIGINS],
    })
  }

  /** Corrige ou valide une traduction : elle devient manuelle et n'est plus écrasée. */
  async correct(ctx: HttpContext) {
    const { bouncer, params, request, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'ai.manage')

    const values = await request.validateUsing(adminAiCorrectionValidator)
    const entity = TRANSLATABLE_ENTITIES.find((candidate) => candidate === params.entity)
    if (!entity) return response.notFound()

    const saved = await this.service.correct(
      entity,
      Number(params.id),
      params.translationLocale,
      values,
      adminActionContext(ctx)
    )
    if (saved) session.flash('success', i18n.t('admin.ai.flash.corrected'))
    else session.flash('error', i18n.t('admin.ai.flash.invalid'))
    return response.redirect().back()
  }
}
