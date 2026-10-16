import type Product from '#models/product'
import { BaseTransformer } from '@adonisjs/core/transformers'
import ProductImageTransformer from '#transformers/product_image_transformer'
import { CONTENT_LOCALES, type ContentLocale } from '#shared/types/i18n'
import type { ProductEditType } from '#shared/types/product'

/**
 * Produit pour le formulaire d'édition fournisseur : traductions par locale
 * (les deux, vides si absentes), facettes sélectionnées et galerie. Requiert
 * `translations`, `attributeValues` et `images` préchargés (cf. `findOwned`).
 */
export default class ProductEditTransformer extends BaseTransformer<Product> {
  toObject(): ProductEditType {
    const translations = {} as Record<ContentLocale, { name: string; description: string | null }>
    for (const locale of CONTENT_LOCALES) {
      const row = this.resource.translations.find((t) => t.locale === locale)
      translations[locale] = { name: row?.name ?? '', description: row?.description ?? null }
    }

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      categoryId: this.resource.categoryId,
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
    }
  }
}
