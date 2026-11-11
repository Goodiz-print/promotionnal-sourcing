import { AdImpressionSchema } from '#database/schema'
import type { AdPlacement } from '#shared/types/ads'

/** Compteur d'affichages d'une campagne, par jour et par emplacement. */
export default class AdImpression extends AdImpressionSchema {
  static table = 'ad_impressions'

  declare placement: AdPlacement
}
