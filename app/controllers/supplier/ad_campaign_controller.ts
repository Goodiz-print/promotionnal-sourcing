import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AdCampaignService from '#services/ad_campaign_service'
import AdTopUpService from '#services/ad_top_up_service'
import AdWalletService from '#services/ad_wallet_service'
import OrganizationContextService from '#services/organization_context_service'
import AdCampaignTransformer from '#transformers/ad_campaign_transformer'
import AdWalletTransactionTransformer from '#transformers/ad_wallet_transaction_transformer'
import {
  AdCampaignIncoherentException,
  AdCampaignNotFoundException,
  AdCampaignSuspendedException,
  AdProductNotEligibleException,
  adCampaignFieldError,
} from '#exceptions/ad_errors'
import {
  adCampaignStatusValidator,
  adCampaignUpdateValidator,
  adCampaignValidator,
} from '#validators/ads'
import { eurosToCents } from '#shared/helpers/ad_money'
import { resolveTranslation } from '#shared/helpers/translations'
import type { AdCampaignInput, AdProductOptionType, AdWalletType } from '#shared/types/ads'
import type { Locale } from '#shared/types/i18n'
import type Organization from '#models/organization'
import type { DateTime } from 'luxon'

const RECENT_TRANSACTIONS = 10

/** Champs d'une campagne tels que validés (euros, dates Luxon). */
interface CampaignPayload {
  maxCpc: number
  dailyBudget: number
  startsOn: DateTime
  endsOn?: DateTime | null
}

/**
 * Produits sponsorisés côté fournisseur (cf. `docs/ads.md`) : portefeuille,
 * campagnes et leurs statistiques. Controller fin : organisation courante +
 * autorisation (`canManageAds`) + validation → services.
 */
@inject()
export default class AdCampaignController {
  constructor(
    private campaigns: AdCampaignService,
    private wallets: AdWalletService,
    private topUps: AdTopUpService,
    private organizations: OrganizationContextService
  ) {}

  /** Tableau de bord : solde, derniers mouvements, campagnes et statistiques. */
  async index(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    const locale = ctx.i18n.locale as Locale

    const [campaigns, balanceCents, transactions] = await Promise.all([
      this.campaigns.listForOrg(org),
      this.wallets.balance(org.id),
      this.wallets.recentTransactions(org.id, RECENT_TRANSACTIONS),
    ])
    const stats = await this.campaigns.statsFor(campaigns.map((campaign) => campaign.id))

    const wallet: AdWalletType = {
      balanceCents,
      topUpEnabled: this.topUps.enabled,
      transactions: transactions.map((transaction) =>
        new AdWalletTransactionTransformer(transaction).toObject()
      ),
    }

    // Retour de la page de paiement : simple message, le crédit vient du webhook.
    const topUp = ctx.request.qs().topUp
    const topUpStatus = topUp === 'success' || topUp === 'cancelled' ? topUp : null

    return ctx.inertia.render('supplier/ads/index', {
      wallet,
      topUpStatus,
      campaigns: campaigns.map((campaign) =>
        new AdCampaignTransformer(campaign, stats.get(campaign.id)!, locale).toObject()
      ),
    })
  }

  /** Formulaire de création : produits de l'organisation encore sans campagne. */
  async create(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    const locale = ctx.i18n.locale as Locale
    const products = await this.campaigns.sponsorableProducts(org)

    const options: AdProductOptionType[] = products.map((product) => ({
      id: product.id,
      name:
        resolveTranslation(product.translations, locale, { sourceLocale: product.sourceLocale })
          ?.name ?? product.slug,
    }))

    return ctx.inertia.render('supplier/ads/create', { products: options })
  }

  async store(ctx: HttpContext) {
    const { request, response, session, i18n } = ctx
    const org = await this.authorize(ctx)
    const { productId, ...payload } = await request.validateUsing(adCampaignValidator)

    try {
      await this.campaigns.create(org, productId, this.input(payload))
    } catch (error) {
      if (error instanceof AdProductNotEligibleException) {
        throw adCampaignFieldError('productId', i18n.t('ads.errors.productNotEligible'), 'eligible')
      }
      throw this.translated(error, ctx)
    }

    session.flash('success', i18n.t('ads.flash.created'))
    return response.redirect().toRoute('supplier.ads.index', { locale: i18n.locale })
  }

  async edit(ctx: HttpContext) {
    const org = await this.authorize(ctx)
    const campaign = await this.owned(org, ctx.params.id)
    const stats = await this.campaigns.statsFor([campaign.id])

    return ctx.inertia.render('supplier/ads/edit', {
      campaign: new AdCampaignTransformer(
        campaign,
        stats.get(campaign.id)!,
        ctx.i18n.locale as Locale
      ).toObject(),
    })
  }

  async update(ctx: HttpContext) {
    const { request, response, session, i18n } = ctx
    const org = await this.authorize(ctx)
    const campaign = await this.owned(org, ctx.params.id)
    const payload = await request.validateUsing(adCampaignUpdateValidator)

    try {
      await this.campaigns.update(campaign, this.input(payload))
    } catch (error) {
      throw this.translated(error, ctx)
    }

    session.flash('success', i18n.t('ads.flash.updated'))
    return response.redirect().toRoute('supplier.ads.index', { locale: i18n.locale })
  }

  /** Pause ou reprise. */
  async updateStatus(ctx: HttpContext) {
    const { request, response, session, i18n } = ctx
    const org = await this.authorize(ctx)
    const campaign = await this.owned(org, ctx.params.id)
    const { status } = await request.validateUsing(adCampaignStatusValidator)

    try {
      await this.campaigns.setStatus(campaign, status)
    } catch (error) {
      if (!(error instanceof AdCampaignSuspendedException)) throw error
      session.flash('error', i18n.t('ads.flash.suspended'))
      return response.redirect().back()
    }

    session.flash('success', i18n.t(status === 'active' ? 'ads.flash.resumed' : 'ads.flash.paused'))
    return response.redirect().back()
  }

  async destroy(ctx: HttpContext) {
    const { response, session, i18n } = ctx
    const org = await this.authorize(ctx)
    await this.campaigns.delete(await this.owned(org, ctx.params.id))

    session.flash('success', i18n.t('ads.flash.deleted'))
    return response.redirect().back()
  }

  private async authorize({ auth, bouncer }: HttpContext): Promise<Organization> {
    const org = await this.organizations.currentFor(auth.getUserOrFail())
    await bouncer.authorize('canManageAds', org)
    return org
  }

  private async owned(org: Organization, id: unknown) {
    const campaign = await this.campaigns.findOwned(org, Number(id))
    if (!campaign) throw new AdCampaignNotFoundException()
    return campaign
  }

  /** Euros et dates du formulaire → centimes et dates ISO du service. */
  private input(payload: CampaignPayload): AdCampaignInput {
    return {
      maxCpcCents: eurosToCents(payload.maxCpc),
      dailyBudgetCents: eurosToCents(payload.dailyBudget),
      startsOn: payload.startsOn.toISODate()!,
      endsOn: payload.endsOn?.toISODate() ?? null,
    }
  }

  /** Incohérence entre champs → erreur de validation du champ, traduite. */
  private translated(error: unknown, { i18n }: HttpContext): unknown {
    if (!(error instanceof AdCampaignIncoherentException)) return error
    return adCampaignFieldError(error.field, i18n.t(`ads.errors.${error.reason}`), error.reason)
  }
}
