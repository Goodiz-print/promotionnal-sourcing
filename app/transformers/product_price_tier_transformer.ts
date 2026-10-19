import type ProductPriceTier from '#models/product_price_tier'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { ProductPriceTierType } from '#shared/types/product'

export default class ProductPriceTierTransformer extends BaseTransformer<ProductPriceTier> {
  toObject(): ProductPriceTierType {
    return this.pick(this.resource, ['id', 'variantId', 'minQuantity', 'unitPrice', 'currency'])
  }
}
