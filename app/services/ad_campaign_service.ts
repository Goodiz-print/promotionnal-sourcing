import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import AdCampaign from '#models/ad_campaign'
import AdWallet from '#models/ad_wallet'
import type Organization from '#models/organization'
import Product from '#models/product'
import {
  AdCampaignIncoherentException,
  AdCampaignSuspendedException,
  AdProductNotEligibleException,
} from '#exceptions/ad_errors'
import type { AdCampaignInput, AdCampaignStatsType } from '#shared/types/ads'

const NO_STATS: AdCampaignStatsType = { impressions: 0, clicks: 0, billedClicks: 0, spentCents: 0 }

/**
 * Campagnes de sponsorisation d'une organisation fournisseuse (cf.
 * `docs/ads.md`) : création, modification, pause, suppression, statistiques.
 * La diffusion elle-même est décidée par `AdAuctionService`.
 */
export default class AdCampaignService {
  /** Campagnes de l'organisation, produit et traductions préchargés. */
  listForOrg(org: Organization): Promise<AdCampaign[]> {
    return AdCampaign.query()
      .where('organizationId', org.id)
      .preload('product', (product) => product.preload('translations'))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
  }

  /** Campagne de l'organisation, ou `null` (inexistante ou d'une autre organisation). */
  findOwned(org: Organization, id: number): Promise<AdCampaign | null> {
    return AdCampaign.query()
      .where('id', id)
      .where('organizationId', org.id)
      .preload('product', (product) => product.preload('translations'))
      .first()
  }

  /** Produits actifs de l'organisation qui n'ont pas encore de campagne. */
  sponsorableProducts(org: Organization): Promise<Product[]> {
    return Product.query()
      .where('isActive', true)
      .whereHas('supplier', (supplier) => supplier.where('organizationId', org.id))
      .whereNotIn('id', AdCampaign.query().select('productId'))
      .preload('translations')
      .orderBy('slug')
  }

  /**
   * Crée la campagne d'un produit de l'organisation. Lève
   * `AdProductNotEligibleException` si le produit n'est pas à elle, est inactif
   * ou a déjà une campagne.
   */
  async create(org: Organization, productId: number, input: AdCampaignInput): Promise<AdCampaign> {
    this.assertCoherent(input)

    const product = await Product.query()
      .where('id', productId)
      .where('isActive', true)
      .whereHas('supplier', (supplier) => supplier.where('organizationId', org.id))
      .first()
    const taken = product ? await AdCampaign.findBy('productId', product.id) : null
    if (!product || taken) throw new AdProductNotEligibleException()

    return AdCampaign.create({
      organizationId: org.id,
      productId: product.id,
      status: 'active',
      ...this.columns(input),
    })
  }

  /** Modifie l'enchère, le budget et la période. Le produit ne change pas. */
  async update(campaign: AdCampaign, input: AdCampaignInput): Promise<AdCampaign> {
    this.assertCoherent(input)
    return campaign.merge(this.columns(input)).save()
  }

  /**
   * Pause ou reprise par le fournisseur. Une campagne suspendue par l'équipe
   * plateforme ne se réactive pas d'ici.
   */
  async setStatus(campaign: AdCampaign, status: 'active' | 'paused'): Promise<AdCampaign> {
    if (campaign.status === 'suspended') throw new AdCampaignSuspendedException()
    return campaign.merge({ status }).save()
  }

  /**
   * Supprime la campagne et ses statistiques. Les débits déjà passés restent
   * au journal du portefeuille.
   */
  async delete(campaign: AdCampaign): Promise<void> {
    await campaign.delete()
  }

  /** Statistiques cumulées par campagne (zéros pour une campagne sans activité). */
  async statsFor(campaignIds: number[]): Promise<Map<number, AdCampaignStatsType>> {
    const stats = new Map<number, AdCampaignStatsType>(
      campaignIds.map((id) => [id, { ...NO_STATS }])
    )
    if (campaignIds.length === 0) return stats

    const [impressions, clicks] = await Promise.all([
      db
        .from('ad_impressions')
        .whereIn('campaign_id', campaignIds)
        .groupBy('campaign_id')
        .select('campaign_id')
        .sum('count as impressions'),
      db
        .from('ad_clicks')
        .whereIn('campaign_id', campaignIds)
        .groupBy('campaign_id')
        .select('campaign_id')
        .select(db.raw('COUNT(*) AS clicks'))
        .select(db.raw('COUNT(*) FILTER (WHERE billed) AS billed_clicks'))
        .select(db.raw('COALESCE(SUM(cost_cents), 0) AS spent_cents')),
    ])

    for (const row of impressions) {
      stats.get(Number(row.campaign_id))!.impressions = Number(row.impressions)
    }
    for (const row of clicks) {
      const entry = stats.get(Number(row.campaign_id))!
      entry.clicks = Number(row.clicks)
      entry.billedClicks = Number(row.billed_clicks)
      entry.spentCents = Number(row.spent_cents)
    }
    return stats
  }

  // ── Supervision (back-office) ──────────────────────────────────────────────

  /** Toutes les campagnes, organisation et produit préchargés. */
  listAll(page: number, perPage: number): Promise<ModelPaginatorContract<AdCampaign>> {
    return AdCampaign.query()
      .preload('organization')
      .preload('product', (product) => product.preload('translations'))
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .paginate(page, perPage)
  }

  /** Soldes des portefeuilles de ces organisations (0 sans portefeuille). */
  async balancesFor(organizationIds: number[]): Promise<Map<number, number>> {
    const balances = new Map<number, number>(organizationIds.map((id) => [id, 0]))
    if (organizationIds.length === 0) return balances
    const wallets = await AdWallet.query().whereIn('organizationId', organizationIds)
    for (const wallet of wallets) balances.set(wallet.organizationId, wallet.balanceCents)
    return balances
  }

  private columns(input: AdCampaignInput) {
    return {
      maxCpcCents: input.maxCpcCents,
      dailyBudgetCents: input.dailyBudgetCents,
      startsOn: DateTime.fromISO(input.startsOn),
      endsOn: input.endsOn ? DateTime.fromISO(input.endsOn) : null,
    }
  }

  /**
   * Règles entre champs, que le validateur ne voit pas : le budget du jour doit
   * couvrir au moins un clic, et la fin ne précède pas le début.
   */
  private assertCoherent(input: AdCampaignInput): void {
    if (input.dailyBudgetCents < input.maxCpcCents) {
      throw new AdCampaignIncoherentException('dailyBudget', 'budgetBelowBid')
    }
    if (input.endsOn && input.endsOn < input.startsOn) {
      throw new AdCampaignIncoherentException('endsOn', 'endBeforeStart')
    }
  }
}
