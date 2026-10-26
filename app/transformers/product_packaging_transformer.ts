import type ProductPackaging from '#models/product_packaging'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { ProductPackagingType } from '#shared/types/product'

/**
 * Conditionnement / logistique produit (écart 3) sérialisé pour le frontend.
 * `outerCartonVolumeM3` reste une chaîne (décimal sérialisé par Lucid).
 */
export default class ProductPackagingTransformer extends BaseTransformer<ProductPackaging> {
  toObject(): ProductPackagingType {
    return this.pick(this.resource, [
      'packageType',
      'unitGrossWeightG',
      'innerCartonQty',
      'outerCartonQty',
      'outerCartonLengthMm',
      'outerCartonWidthMm',
      'outerCartonHeightMm',
      'outerCartonGrossWeightG',
      'outerCartonVolumeM3',
    ])
  }
}
