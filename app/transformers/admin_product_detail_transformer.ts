import { BaseTransformer } from '@adonisjs/core/transformers'
import type { AdminProductDetails } from '#services/admin_product_service'
import type { AdminProductDetail } from '#shared/types/admin_product'
import type { ModerationStatus } from '#shared/types/moderation'
import { resolveTranslation } from '#shared/helpers/translations'
import type { TranslationLocale } from '#shared/types/i18n'

interface TransformOptions {
  canManage: boolean
  locale: TranslationLocale
}

/**
 * Fiche d'un produit du back-office : colonnes de la liste + toutes les
 * informations détaillées (variantes, prix, images, traductions, etc.).
 */
export default class AdminProductDetailTransformer extends BaseTransformer<AdminProductDetails> {
  constructor(
    resource: AdminProductDetails,
    private options: TransformOptions
  ) {
    super(resource)
  }

  toObject(): AdminProductDetail {
    const {
      product,
      visibilityStatus,
      moderationStatus,
      moderationHistory,
      variants,
      priceTiers,
      images,
      translations,
      certifications,
      attributes,
      supplierName,
      supplierSlug,
      supplierOrganizationId,
      categoryName,
      categorySlug,
      variantsCount,
      imagesCount,
    } = this.resource

    // Nom du produit traduit
    const nameResolved = resolveTranslation(product.translations, this.options.locale, {
      sourceLocale: product.sourceLocale,
      fallback: 'fr',
    })

    return {
      id: product.id,
      name: nameResolved?.name ?? null,
      slug: product.slug,
      supplierName,
      supplierSlug,
      supplierOrganizationId,
      categoryName,
      categorySlug,
      visibilityStatus,
      variantsCount,
      imagesCount,
      stockStatus: product.stockStatus,
      createdAt: product.createdAt.toISO()!,
      isActive: product.isActive,
      lifecycleStatus: product.lifecycleStatus,
      moderationStatus: moderationStatus as ModerationStatus,
      moderationHistory,
      variants,
      priceTiers,
      images,
      translations,
      certifications,
      attributes,
      canManage: this.options.canManage,
    }
  }
}
