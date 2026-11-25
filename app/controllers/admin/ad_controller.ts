import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { adminActionContext } from '#services/admin_audit_service'
import AdminAdService from '#services/admin_ad_service'
import AdCampaignService from '#services/ad_campaign_service'
import AdCampaignTransformer from '#transformers/ad_campaign_transformer'
import { InsufficientAdFundsException } from '#exceptions/ad_errors'
import { AdminOrganizationNotFoundException } from '#exceptions/admin_errors'
import { adminAdListValidator, adminAdWalletAdjustmentValidator } from '#validators/ads'
import { eurosToCents } from '#shared/helpers/ad_money'
import type { AdminAdCampaignsType } from '#shared/types/ads'
import type { Locale } from '#shared/types/i18n'

const PER_PAGE = 25

/**
 * Supervision des produits sponsorisés (cf. `docs/ads.md`) : toutes les
 * campagnes, suspension, ajustement manuel des portefeuilles. Droit
 * `ads.manage` (admin seul).
 */
@inject()
export default class AdController {
  constructor(
    private campaigns: AdCampaignService,
    private actions: AdminAdService
  ) {}

  async index({ bouncer, inertia, request, i18n }: HttpContext) {
    await bouncer.authorize('hasPlatformPermission', 'ads.manage')
    const { page } = await request.validateUsing(adminAdListValidator, { data: request.qs() })
    const locale = i18n.locale as Locale

    const paginator = await this.campaigns.listAll(page ?? 1, PER_PAGE)
    const rows = paginator.all()
    const [stats, balances] = await Promise.all([
      this.campaigns.statsFor(rows.map((campaign) => campaign.id)),
      this.campaigns.balancesFor([...new Set(rows.map((campaign) => campaign.organizationId))]),
    ])

    const campaigns: AdminAdCampaignsType = {
      data: rows.map((campaign) => ({
        ...new AdCampaignTransformer(campaign, stats.get(campaign.id)!, locale).toObject(),
        organizationId: campaign.organizationId,
        organizationName: campaign.organization.name,
        walletBalanceCents: balances.get(campaign.organizationId) ?? 0,
      })),
      meta: {
        total: paginator.total,
        perPage: paginator.perPage,
        currentPage: paginator.currentPage,
        lastPage: paginator.lastPage,
      },
    }

    return inertia.render('admin/ads/index', { campaigns })
  }

  async suspend(ctx: HttpContext) {
    return this.setSuspended(ctx, true)
  }

  async restore(ctx: HttpContext) {
    return this.setSuspended(ctx, false)
  }

  /** Crédit ou débit manuel d'un portefeuille. */
  async adjustWallet(ctx: HttpContext) {
    const { bouncer, request, response, session, i18n } = ctx
    await bouncer.authorize('hasPlatformPermission', 'ads.manage')
    const payload = await request.validateUsing(adminAdWalletAdjustmentValidator)

    try {
      await this.actions.adjustWallet(
        payload.organizationId,
        eurosToCents(payload.amount),
        payload.note,
        adminActionContext(ctx)
      )
    } catch (error) {
      const key =
        error instanceof InsufficientAdFundsException
          ? 'admin.ads.flash.insufficientFunds'
          : error instanceof AdminOrganizationNotFoundException
            ? 'admin.ads.flash.organizationNotFound'
            : null
      if (!key) throw error
      session.flash('error', i18n.t(key))
      return response.redirect().back()
    }

    session.flash('success', i18n.t('admin.ads.flash.adjusted'))
    return response.redirect().back()
  }

  private async setSuspended(ctx: HttpContext, suspended: boolean) {
    const { bouncer, response, session, i18n, params } = ctx
    await bouncer.authorize('hasPlatformPermission', 'ads.manage')

    await this.actions.setSuspended(Number(params.id), suspended, adminActionContext(ctx))

    session.flash('success', i18n.t(`admin.ads.flash.${suspended ? 'suspended' : 'restored'}`))
    return response.redirect().back()
  }
}
