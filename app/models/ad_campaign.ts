import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { AdCampaignSchema } from '#database/schema'
import Organization from '#models/organization'
import Product from '#models/product'
import type { AdCampaignStatus } from '#shared/types/ads'

/**
 * Campagne de sponsorisation d'un produit (cf. `docs/ads.md`). Au plus une par
 * produit.
 */
export default class AdCampaign extends AdCampaignSchema {
  static table = 'ad_campaigns'

  declare status: AdCampaignStatus

  @belongsTo(() => Organization)
  declare organization: BelongsTo<typeof Organization>

  @belongsTo(() => Product)
  declare product: BelongsTo<typeof Product>
}
