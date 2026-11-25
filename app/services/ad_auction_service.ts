import { DateTime } from 'luxon'
import AdCampaign from '#models/ad_campaign'
import type { AdAuctionCandidate } from '#shared/types/ads'

/** Restrictions d'une sélection de campagnes éligibles. */
export interface AdEligibilityOptions {
  /** Ne garder que les produits de cette catégorie (bloc de la fiche produit). */
  categoryId?: number | null
  /** Produits à écarter (la fiche en cours de consultation). */
  excludeProductIds?: number[]
}

/**
 * Campagnes pouvant participer à une enchère **maintenant** (cf. `docs/ads.md`).
 * Une campagne est éligible si, à la fois :
 *
 * - elle est `active` et la date du jour est dans sa période ;
 * - son produit est visible du catalogue (actif, organisation vivante, non rejeté) ;
 * - le portefeuille de l'organisation couvre au moins un clic à l'enchère maximale ;
 * - le budget du jour laisse la place d'un clic à l'enchère maximale — une
 *   campagne ne dépasse donc jamais son budget quotidien.
 *
 * La pertinence (recherche, filtres) est vérifiée ensuite par
 * `SponsoredProductService` ; le prix par `runAdAuction`.
 */
export default class AdAuctionService {
  async eligible(options: AdEligibilityOptions = {}): Promise<AdAuctionCandidate[]> {
    const now = DateTime.now()
    const today = now.toISODate()!
    const exclude = options.excludeProductIds ?? []

    const campaigns = await AdCampaign.query()
      .select('id', 'productId', 'organizationId', 'maxCpcCents')
      .where('status', 'active')
      .where('startsOn', '<=', today)
      .where((period) => period.whereNull('endsOn').orWhere('endsOn', '>=', today))
      .if(exclude.length > 0, (query) => query.whereNotIn('productId', exclude))
      .whereHas('product', (product) =>
        product
          .where('isActive', true)
          .withScopes((scopes) => {
            scopes.fromLiveOrganization()
            scopes.notRejected()
          })
          .if(options.categoryId, (query) => query.where('categoryId', options.categoryId!))
      )
      .whereRaw(
        `EXISTS (
          SELECT 1 FROM ad_wallets w
          WHERE w.organization_id = ad_campaigns.organization_id
            AND w.balance_cents >= ad_campaigns.max_cpc_cents
        )`
      )
      .whereRaw(
        `(
          SELECT COALESCE(SUM(c.cost_cents), 0) FROM ad_clicks c
          WHERE c.campaign_id = ad_campaigns.id AND c.billed AND c.created_at >= ?
        ) + ad_campaigns.max_cpc_cents <= ad_campaigns.daily_budget_cents`,
        [now.startOf('day').toSQL()!]
      )

    return campaigns.map((campaign) => ({
      campaignId: campaign.id,
      productId: campaign.productId,
      organizationId: campaign.organizationId,
      maxCpcCents: campaign.maxCpcCents,
    }))
  }
}
