import type Product from '#models/product'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import ProductTransformer from '#transformers/product_transformer'
import ProductImageTransformer from '#transformers/product_image_transformer'
import type { ProductDetailType } from '#shared/types/product'

/**
 * Fiche produit détaillée pour le catalogue public : le produit localisé +
 * un résumé fournisseur/catégorie + les facettes résolues (nom d'attribut +
 * libellé de valeur). Requiert `translations`, `supplier.translations`,
 * `category.translations`, `productAttributes.{attribute,attributeValue}.translations`
 * et `images` préchargés (voir `ProductCatalogueService.findBySlug`).
 */
export default class ProductDetailTransformer extends BaseTransformer<Product> {
  constructor(
    resource: Product,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): ProductDetailType {
    const supplier = this.resource.supplier
    const category = this.resource.category

    return {
      ...new ProductTransformer(this.resource, this.locale).toObject(),
      supplier: {
        slug: supplier.slug,
        name: resolveTranslation(supplier.translations, this.locale)?.name ?? null,
        country: supplier.country,
      },
      category: category
        ? {
            slug: category.slug,
            name: resolveTranslation(category.translations, this.locale)?.name ?? null,
          }
        : null,
      attributes: this.resource.productAttributes.map((pa) => ({
        attributeSlug: pa.attribute?.slug ?? '',
        attributeName: resolveTranslation(pa.attribute?.translations, this.locale)?.name ?? null,
        label: pa.attributeValue
          ? (resolveTranslation(pa.attributeValue.translations, this.locale)?.label ?? null)
          : (pa.valueString ?? pa.valueNumber ?? null),
      })),
      images: this.resource.images.map((image) => new ProductImageTransformer(image).toObject()),
    }
  }
}
