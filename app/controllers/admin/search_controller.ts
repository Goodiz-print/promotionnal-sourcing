import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminSearchService from '#services/admin_search_service'
import { adminSearchReindexValidator } from '#validators/admin_search'
import type { SearchRequestResult } from '#shared/types/admin_search'

/**
 * État de la recherche (#176), droit `search.manage` (admin) : santé de
 * Meilisearch, écart avec PostgreSQL, réindexation et évaluation de pertinence
 * traitées par la queue. Controller fin : droit, validation, puis
 * `AdminSearchService`.
 */
@inject()
export default class SearchController {
  constructor(private service: AdminSearchService) {}

  async index({ bouncer, inertia }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'search.manage')

    return inertia.render('admin/search/index', {
      status: await this.service.status(),
      runs: await this.service.runs(),
      suppliers: await this.service.suppliers(),
      // Parcourt tout le catalogue : calculé à la demande (rechargement partiel).
      drift: inertia.optional(() => this.service.drift()),
    })
  }

  /** Met en file la réindexation (complète, ou d'un fournisseur). */
  async reindex(ctx: HttpContext) {
    const { bouncer, request, response, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'search.manage')

    const { supplierId } = await request.validateUsing(adminSearchReindexValidator)
    const result = await this.service.requestReindex(supplierId ?? null, adminActionContext(ctx))

    this.flash(ctx, result, 'reindex')
    return response.redirect().toRoute('admin.search.index', { locale: i18n.locale })
  }

  /** Met en file l'évaluation de pertinence. */
  async evaluate(ctx: HttpContext) {
    const { bouncer, response, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'search.manage')

    const result = await this.service.requestEvaluation(adminActionContext(ctx))

    this.flash(ctx, result, 'evaluation')
    return response.redirect().toRoute('admin.search.index', { locale: i18n.locale })
  }

  private flash(
    { session, i18n }: HttpContext,
    result: SearchRequestResult,
    kind: 'reindex' | 'evaluation'
  ) {
    if (result === 'queued') session.flash('success', i18n.t(`admin.search.flash.${kind}Queued`))
    else session.flash('error', i18n.t(`admin.search.flash.${result}`))
  }
}
