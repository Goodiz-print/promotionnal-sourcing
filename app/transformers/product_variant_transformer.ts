import type ProductVariant from '#models/product_variant'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { ProductDetailVariantType, ProductVariantType } from '#shared/types/product'

/**
 * Variante pour le formulaire fournisseur. Requiert `attributes` préchargé.
 */
export default class ProductVariantTransformer extends BaseTransformer<ProductVariant> {
  toObject(): ProductVariantType {
    return {
      id: this.resource.id,
      sku: this.resource.sku,
      isActive: this.resource.isActive,
      imageId: this.resource.imageId,
      gtin: this.resource.gtin,
      // Stock par variante (plan L98) : exposé pour l'aller-retour édition.
      stockQuantity: this.resource.stockQuantity,
      stockStatus: this.resource.stockStatus,
      attributeValueIds: this.resource.attributes.map((pivot) => pivot.attributeValueId),
    }
  }
}

/**
 * Variante de la fiche publique : facettes résolues dans la locale. Requiert
 * `attributes.{attribute,attributeValue}.translations` préchargés.
 */
export class ProductDetailVariantTransformer extends BaseTransformer<ProductVariant> {
  constructor(
    resource: ProductVariant,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): ProductDetailVariantType {
    return {
      ...new ProductVariantTransformer(this.resource).toObject(),
      attributes: this.resource.attributes.map((pivot) => ({
        attributeSlug: pivot.attribute?.slug ?? '',
        attributeName: resolveTranslation(pivot.attribute?.translations, this.locale)?.name ?? null,
        label: resolveTranslation(pivot.attributeValue?.translations, this.locale)?.label ?? null,
      })),
    }
  }
}
