import { BaseTransformer } from '@adonisjs/core/transformers'
import { signedUrlFor } from '@adonisjs/core/services/url_builder'
import ProductTransformer from '#transformers/product_transformer'
import type { SponsoredSelection } from '#services/sponsored_product_service'
import {
  AD_CLICK_SIGNATURE_PURPOSE,
  AD_CLICK_URL_TTL_HOURS,
  type SponsoredProductType,
} from '#shared/types/ads'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'

/**
 * Produit sponsorisé envoyé au front : la vignette et son lien de clic.
 *
 * Le lien est **signé** : il porte l'emplacement (`p`) et le prix du clic fixé
 * par l'enchère (`c`). Le visiteur ne peut ni modifier ce prix ni fabriquer un
 * clic facturable pour une autre campagne.
 */
export default class SponsoredProductTransformer extends BaseTransformer<SponsoredSelection> {
  constructor(
    resource: SponsoredSelection,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): SponsoredProductType {
    const { product, winner, placement } = this.resource

    return {
      product: new ProductTransformer(product, this.locale).toObject(),
      clickUrl: signedUrlFor(
        'ads.click',
        { locale: this.locale, id: winner.campaignId },
        {
          expiresIn: `${AD_CLICK_URL_TTL_HOURS}h`,
          purpose: AD_CLICK_SIGNATURE_PURPOSE,
          qs: { p: placement, c: winner.costCents },
        }
      ),
    }
  }
}
