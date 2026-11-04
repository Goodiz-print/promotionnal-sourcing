import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminMessagingActionService from '#services/admin_messaging_action_service'
import AdminMessagingService from '#services/admin_messaging_service'
import {
  adminBlockConversationValidator,
  adminConversationFiltersValidator,
  adminModerationNoteValidator,
  adminReportFiltersValidator,
} from '#validators/admin_messaging'
import type { AdminConversationFilters, AdminReportFilters } from '#shared/types/admin_messaging'

const PER_PAGE = 25

/**
 * Modération de la messagerie acheteur ↔ fournisseur (#167), droit
 * `moderation.manage`. La consultation d'un fil est tracée (audit) ; les
 * décisions (masquer, avertir, classer, bloquer) passent par
 * `AdminMessagingActionService`.
 */
@inject()
export default class MessagingController {
  constructor(
    private messaging: AdminMessagingService,
    private actions: AdminMessagingActionService
  ) {}

  /** Liste des fils (sans contenu) avec leurs signalements ouverts. */
  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'moderation.manage')

    const query = await request.validateUsing(adminConversationFiltersValidator, {
      data: request.qs(),
    })
    const filters: AdminConversationFilters = {
      buyer: query.buyer ?? null,
      supplier: query.supplier ?? null,
      withOpenReports: query.withOpenReports ?? false,
      blocked: query.blocked ?? false,
    }

    return inertia.render('admin/messaging/index', {
      conversations: await this.messaging.listConversations({
        ...filters,
        page: query.page ?? 1,
        perPage: PER_PAGE,
      }),
      filters,
    })
  }

  /** File des signalements (ouverts par défaut). */
  async reports({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'moderation.manage')

    const query = await request.validateUsing(adminReportFiltersValidator, { data: request.qs() })
    const filters: AdminReportFilters = { status: query.status ?? 'open' }

    return inertia.render('admin/messaging/reports', {
      reports: await this.messaging.listReports({
        ...filters,
        page: query.page ?? 1,
        perPage: PER_PAGE,
      }),
      filters,
    })
  }

  /** Fil complet. Chaque ouverture est inscrite au journal d'audit. */
  async show(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'moderation.manage')

    return ctx.inertia.render('admin/messaging/show', {
      detail: await this.messaging.detail(+ctx.params.id, adminActionContext(ctx)),
    })
  }

  async hide(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'moderation.manage')
    const { note } = await ctx.request.validateUsing(adminModerationNoteValidator)

    await this.actions.hideMessage({
      messageId: +ctx.params.id,
      note,
      context: adminActionContext(ctx),
    })
    ctx.session.flash('success', ctx.i18n.t('admin.messaging.done.hidden'))
    return ctx.response.redirect().back()
  }

  async unhide(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'moderation.manage')

    await this.actions.unhideMessage({
      messageId: +ctx.params.id,
      context: adminActionContext(ctx),
    })
    ctx.session.flash('success', ctx.i18n.t('admin.messaging.done.unhidden'))
    return ctx.response.redirect().back()
  }

  async warn(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'moderation.manage')
    const { note } = await ctx.request.validateUsing(adminModerationNoteValidator)

    await this.actions.warnAuthor({
      messageId: +ctx.params.id,
      note,
      context: adminActionContext(ctx),
    })
    ctx.session.flash('success', ctx.i18n.t('admin.messaging.done.warned'))
    return ctx.response.redirect().back()
  }

  async dismiss(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'moderation.manage')
    const { note } = await ctx.request.validateUsing(adminModerationNoteValidator)

    await this.actions.dismissReport({
      reportId: +ctx.params.id,
      note,
      context: adminActionContext(ctx),
    })
    ctx.session.flash('success', ctx.i18n.t('admin.messaging.done.dismissed'))
    return ctx.response.redirect().back()
  }

  async block(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'moderation.manage')
    const { reason } = await ctx.request.validateUsing(adminBlockConversationValidator)

    await this.actions.blockConversation({
      conversationId: +ctx.params.id,
      reason,
      context: adminActionContext(ctx),
    })
    ctx.session.flash('success', ctx.i18n.t('admin.messaging.done.blocked'))
    return ctx.response.redirect().back()
  }

  async unblock(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'moderation.manage')

    await this.actions.unblockConversation({
      conversationId: +ctx.params.id,
      context: adminActionContext(ctx),
    })
    ctx.session.flash('success', ctx.i18n.t('admin.messaging.done.unblocked'))
    return ctx.response.redirect().back()
  }
}
