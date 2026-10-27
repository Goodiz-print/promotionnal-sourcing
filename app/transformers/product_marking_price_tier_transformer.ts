import type ProductMarkingPriceTier from '#models/product_marking_price_tier'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { ProductMarkingPriceTierType } from '#shared/types/marking'

/**
 * Palier de la grille de prix de marquage (écart 2) sérialisé pour le frontend.
 * La technique est résolue dans la locale active. Requiert `technique.translations`
 * préchargé. `unitPrice` reste une chaîne (décimal sérialisé par Lucid).
 */
export default class ProductMarkingPriceTierTransformer extends BaseTransformer<ProductMarkingPriceTier> {
  constructor(
    resource: ProductMarkingPriceTier,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): ProductMarkingPriceTierType {
    return {
      id: this.resource.id,
      markingTechniqueId: this.resource.markingTechniqueId,
      techniqueSlug: this.resource.technique?.slug ?? '',
      techniqueName:
        resolveTranslation(this.resource.technique?.translations, this.locale)?.name ?? null,
      minQuantity: this.resource.minQuantity,
      unitPrice: this.resource.unitPrice,
      currency: this.resource.currency,
    }
  }
}
