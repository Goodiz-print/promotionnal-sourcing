import type Product from '#models/product'
import { BaseTransformer } from '@adonisjs/core/transformers'
import ProductImageTransformer from '#transformers/product_image_transformer'
import ProductVariantTransformer from '#transformers/product_variant_transformer'
import ProductPriceTierTransformer from '#transformers/product_price_tier_transformer'
import ProductDocumentTransformer from '#transformers/product_document_transformer'
import type StorageObject from '#models/storage_object'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { ProductEditType } from '#shared/types/product'

/**
 * Produit pour le formulaire d'édition fournisseur : traductions par locale
 * (les deux, vides si absentes), facettes sélectionnées et galerie. Requiert
 * `translations`, `attributeValues`, `images`, `variants.attributes` et
 * `priceTiers` et `documents.storageObject` préchargés (cf. `findOwned`).
 */
export default class ProductEditTransformer extends BaseTransformer<Product> {
  constructor(
    resource: Product,
    protected documentUrl: (object: StorageObject) => string
  ) {
    super(resource)
  }

  toObject(): ProductEditType {
    const translations = {} as ProductEditType['translations']
    for (const locale of CONTENT_LOCALES) {
      const row = this.resource.translations.find((t) => t.locale === locale)
      translations[locale] = {
        name: row?.name ?? '',
        description: row?.description ?? null,
        isAuto: row?.isAuto ?? false,
        keywords: row?.keywords ?? null,
        marketingPoints: row?.marketingPoints ?? null,
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
      // Identité/classification (écart 5), commercial (écart 7), médias (écart 8).
      brand: this.resource.brand,
      hsCode: this.resource.hsCode,
      isConfigurable: this.resource.isConfigurable,
      lifecycleStatus: this.resource.lifecycleStatus,
      releasedAt: this.resource.releasedAt?.toISODate() ?? null,
      supplierCategoryRaw: this.resource.supplierCategoryRaw,
      leadTimeDays: this.resource.leadTimeDays,
      rushService: this.resource.rushService,
      rushLeadTimeDays: this.resource.rushLeadTimeDays,
      videoUrl: this.resource.videoUrl,
      // Provenance dérivée (écart 9), lecture seule.
      originZone: this.resource.originZone,
      translations,
      attributeValueIds: this.resource.attributeValues.map((value) => value.id),
      images: this.resource.images.map((image) => new ProductImageTransformer(image).toObject()),
      variants: this.resource.variants.map((variant) =>
        new ProductVariantTransformer(variant).toObject()
      ),
      priceTiers: this.resource.priceTiers.map((tier) =>
        new ProductPriceTierTransformer(tier).toObject()
      ),
      documents: this.resource.documents.map((document) =>
        new ProductDocumentTransformer(document, this.documentUrl).toObject()
      ),
    }
  }
}
