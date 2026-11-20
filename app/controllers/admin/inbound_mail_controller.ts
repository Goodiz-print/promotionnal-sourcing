import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminInboundMailService from '#services/admin_inbound_mail_service'
import AdminInboundMailTransformer, {
  inboundMailPage,
  inboundMailRecipient,
} from '#transformers/admin_inbound_mail_transformer'
import {
  adminInboundMailAttachValidator,
  adminInboundMailFiltersValidator,
  adminInboundMailShowValidator,
} from '#validators/admin_inbound_mail'
import {
  ADMIN_INBOUND_MAIL_PER_PAGE,
  type AdminInboundMailFilters,
  type AdminInboundMailOutcome,
} from '#shared/types/admin_inbound_mail'
import { INBOUND_MAIL_REJECTIONS, INBOUND_MAIL_STATUSES } from '#shared/types/inbound_mail'

/** Message flash de chaque issue d'un rattachement ou d'un rejeu. */
const OUTCOME_FLASH: Record<AdminInboundMailOutcome, { type: 'success' | 'error'; key: string }> = {
  processed: { type: 'success', key: 'admin.inboundMail.flash.processed' },
  republished: { type: 'success', key: 'admin.inboundMail.flash.republished' },
  received: { type: 'success', key: 'admin.inboundMail.flash.pending' },
  processing: { type: 'success', key: 'admin.inboundMail.flash.pending' },
  rejected: { type: 'error', key: 'admin.inboundMail.flash.rejected' },
  failed: { type: 'error', key: 'admin.inboundMail.flash.failed' },
  refused: { type: 'error', key: 'admin.inboundMail.flash.notAllowed' },
}

/**
 * Supervision des mails entrants (#227), droit `ops.manage` (admin) : les
 * adresses et le contenu des mails sont des données personnelles. Controller
 * fin : droit, validation, puis `AdminInboundMailService`.
 */
@inject()
export default class InboundMailController {
  constructor(private service: AdminInboundMailService) {}

  async index({ bouncer, inertia, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    const query = await request.validateUsing(adminInboundMailFiltersValidator, {
      data: request.qs(),
    })
    const filters: AdminInboundMailFilters = {
      status: query.status ?? null,
      rejection: query.rejection ?? null,
    }
    const paginator = await this.service.list({
      ...filters,
      page: query.page ?? 1,
      perPage: ADMIN_INBOUND_MAIL_PER_PAGE,
    })

    return inertia.render('admin/inbound_mail/index', {
      overview: await this.service.overview(),
      mails: inboundMailPage(paginator),
      filters,
      statuses: Object.values(INBOUND_MAIL_STATUSES),
      rejections: Object.values(INBOUND_MAIL_REJECTIONS),
    })
  }

  async show({ bouncer, inertia, params, request }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    const { rfq } = await request.validateUsing(adminInboundMailShowValidator, {
      data: request.qs(),
    })
    const mail = await this.service.show(params.id)
    const candidates = await this.service.candidates(mail, rfq ?? null)

    return inertia.render('admin/inbound_mail/show', {
      mail: new AdminInboundMailTransformer(mail).toDetail(),
      candidates: candidates.map((candidate) => inboundMailRecipient(candidate)),
      rfqSearch: rfq ?? null,
    })
  }

  /** Rattache le mail au couple demande / fournisseur choisi, puis le traite. */
  async attach(ctx: HttpContext) {
    const { bouncer, params, request } = ctx
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    const { rfqSupplierId } = await request.validateUsing(adminInboundMailAttachValidator)
    const outcome = await this.service.attach(params.id, rfqSupplierId, adminActionContext(ctx))
    return this.answer(ctx, outcome)
  }

  /** Rejoue le traitement du mail (sans doublon s'il est déjà traité). */
  async replay(ctx: HttpContext) {
    await ctx.bouncer.authorize('hasPlatformPermission', 'ops.manage')

    const outcome = await this.service.replay(ctx.params.id, adminActionContext(ctx))
    return this.answer(ctx, outcome)
  }

  /** Écarte un mail en attente ou en échec. */
  async dismiss(ctx: HttpContext) {
    const { bouncer, params, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'ops.manage')

    const dismissed = await this.service.dismiss(params.id, adminActionContext(ctx))
    if (dismissed) session.flash('success', i18n.t('admin.inboundMail.flash.dismissed'))
    else session.flash('error', i18n.t('admin.inboundMail.flash.notAllowed'))
    return response.redirect().back()
  }

  private answer({ response, session, i18n }: HttpContext, outcome: AdminInboundMailOutcome) {
    const flash = OUTCOME_FLASH[outcome]
    session.flash(flash.type, i18n.t(flash.key))
    return response.redirect().back()
  }
}
