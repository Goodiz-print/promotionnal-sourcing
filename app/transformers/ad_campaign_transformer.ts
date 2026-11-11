import { BaseTransformer } from '@adonisjs/core/transformers'
import type AdCampaign from '#models/ad_campaign'
import { resolveTranslation } from '#shared/helpers/translations'
import type { AdCampaignStatsType, AdCampaignType } from '#shared/types/ads'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'

/**
 * Campagne de sponsorisation et ses statistiques. `product` (avec
 * `translations`) doit être préchargé.
 */
export default class AdCampaignTransformer extends BaseTransformer<AdCampaign> {
  constructor(
    resource: AdCampaign,
    protected stats: AdCampaignStatsType,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): AdCampaignType {
    const { product } = this.resource
    const translation = resolveTranslation(product.translations, this.locale, {
      sourceLocale: product.sourceLocale,
    })

    return {
      ...this.pick(this.resource, ['id', 'productId', 'status', 'maxCpcCents', 'dailyBudgetCents']),
      productName: translation?.name ?? product.slug,
      productSlug: product.slug,
      productImageUrl: product.imageUrl ?? null,
      productVisible: product.isActive,
      startsOn: this.resource.startsOn.toISODate()!,
      endsOn: this.resource.endsOn?.toISODate() ?? null,
      stats: this.stats,
    }
  }
}
