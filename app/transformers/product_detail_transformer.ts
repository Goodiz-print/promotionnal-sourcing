import type Product from '#models/product'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import ProductTransformer from '#transformers/product_transformer'
import ProductImageTransformer from '#transformers/product_image_transformer'
import { ProductDetailVariantTransformer } from '#transformers/product_variant_transformer'
import ProductPriceTierTransformer from '#transformers/product_price_tier_transformer'
import ProductDocumentTransformer from '#transformers/product_document_transformer'
import ProductPackagingTransformer from '#transformers/product_packaging_transformer'
import ProductMarkingPositionTransformer from '#transformers/product_marking_position_transformer'
import ProductMarkingPriceTierTransformer from '#transformers/product_marking_price_tier_transformer'
import CertificationTransformer from '#transformers/certification_transformer'
import type StorageObject from '#models/storage_object'
import type { ProductDetailType } from '#shared/types/product'

/**
 * Fiche produit détaillée pour le catalogue public : le produit localisé +
 * un résumé fournisseur/catégorie + les facettes résolues (nom d'attribut +
 * libellé de valeur). Requiert `translations`, `supplier.translations`,
 * `category.translations`, `productAttributes.{attribute,attributeValue}.translations`
 * et `images`, `variants.attributes.{attribute,attributeValue}.translations` (actives)
 * `priceTiers` et `documents.storageObject` préchargés (voir `ProductCatalogueService.findBySlug`).
 */
export default class ProductDetailTransformer extends BaseTransformer<Product> {
  constructor(
    resource: Product,
    protected locale: Locale = DEFAULT_LOCALE,
    protected documentUrl: (object: StorageObject) => string
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
      // Labels de conformité résolus dans la locale active (écart 4).
      certifications: this.resource.certifications.map((certification) =>
        new CertificationTransformer(certification, this.locale).toObject()
      ),
      images: this.resource.images.map((image) => new ProductImageTransformer(image).toObject()),
      variants: this.resource.variants.map((variant) =>
        new ProductDetailVariantTransformer(variant, this.locale).toObject()
      ),
      priceTiers: this.resource.priceTiers.map((tier) =>
        new ProductPriceTierTransformer(tier).toObject()
      ),
      documents: this.resource.documents.map((document) =>
        new ProductDocumentTransformer(document, this.documentUrl).toObject()
      ),
      // Conditionnement / logistique (écart 3), `null` si non renseigné.
      packaging: this.resource.packaging
        ? new ProductPackagingTransformer(this.resource.packaging).toObject()
        : null,
      // Marquage structuré (écart 2) : positions résolues + grille de prix.
      markingPositions: this.resource.markingPositions.map((position) =>
        new ProductMarkingPositionTransformer(position, this.locale).toObject()
      ),
      markingPriceTiers: this.resource.markingPriceTiers.map((tier) =>
        new ProductMarkingPriceTierTransformer(tier, this.locale).toObject()
      ),
    }
  }
}
