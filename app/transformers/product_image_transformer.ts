import type ProductImage from '#models/product_image'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { IMAGE_VARIANTS } from '#shared/types/image_variant'
import type { ProductImageType } from '#shared/types/product'

/**
 * Requiert `variants` préchargé pour les exposer ; sans lui la liste est vide
 * et le frontend retombe sur l'original (`url`).
 */
export default class ProductImageTransformer extends BaseTransformer<ProductImage> {
  toObject(): ProductImageType {
    const order = IMAGE_VARIANTS.map((variant) => variant.name)
    const variants = [...(this.resource.$preloaded.variants ? this.resource.variants : [])].sort(
      (a, b) => order.indexOf(a.name) - order.indexOf(b.name)
    )

    return {
      id: this.resource.id,
      url: this.resource.secureUrl,
      position: this.resource.position,
      width: this.resource.width,
      height: this.resource.height,
      variants: variants.map((variant) => ({
        name: variant.name,
        url: variant.url,
        width: variant.width,
        height: variant.height,
      })),
    }
  }
}
