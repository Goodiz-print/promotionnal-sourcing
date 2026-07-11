import type ProductImage from '#models/product_image'
import { BaseTransformer } from '@adonisjs/core/transformers'
import type { ProductImageType } from '#shared/types/product'

export default class ProductImageTransformer extends BaseTransformer<ProductImage> {
  toObject(): ProductImageType {
    return {
      id: this.resource.id,
      url: this.resource.secureUrl,
      position: this.resource.position,
      width: this.resource.width,
      height: this.resource.height,
    }
  }
}
