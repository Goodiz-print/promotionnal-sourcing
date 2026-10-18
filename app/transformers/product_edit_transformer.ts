import type Product from '#models/product'
import { BaseTransformer } from '@adonisjs/core/transformers'
import ProductImageTransformer from '#transformers/product_image_transformer'
import ProductVariantTransformer from '#transformers/product_variant_transformer'
import ProductPriceTierTransformer from '#transformers/product_price_tier_transformer'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { ProductEditType } from '#shared/types/product'

/**
 * Produit pour le formulaire d'édition fournisseur : traductions par locale
 * (les deux, vides si absentes), facettes sélectionnées et galerie. Requiert
 * `translations`, `attributeValues`, `images`, `variants.attributes` et
 * `priceTiers` préchargés (cf. `findOwned`).
 */
export default class ProductEditTransformer extends BaseTransformer<Product> {
  toObject(): ProductEditType {
    const translations = {} as ProductEditType['translations']
    for (const locale of CONTENT_LOCALES) {
      const row = this.resource.translations.find((t) => t.locale === locale)
      translations[locale] = {
        name: row?.name ?? '',
        description: row?.description ?? null,
        isAuto: row?.isAuto ?? false,
      }
    }

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      categoryId: this.resource.categoryId,
      sourceLocale: this.resource.sourceLocale as ContentLocale,
      priceMin: this.resource.priceMin,
      priceMax: this.resource.priceMax,
      currency: this.resource.currency,
      minQuantity: this.resource.minQuantity,
      originCountry: this.resource.originCountry,
      madeInEurope: this.resource.madeInEurope,
      isActive: this.resource.isActive,
      translations,
      attributeValueIds: this.resource.attributeValues.map((value) => value.id),
      images: this.resource.images.map((image) => new ProductImageTransformer(image).toObject()),
      variants: this.resource.variants.map((variant) =>
        new ProductVariantTransformer(variant).toObject()
      ),
      priceTiers: this.resource.priceTiers.map((tier) =>
        new ProductPriceTierTransformer(tier).toObject()
      ),
    }
  }
}
