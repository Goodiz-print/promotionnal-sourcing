import { BaseTransformer } from '@adonisjs/core/transformers'
import type Product from '#models/product'
import type {
  AdminProductListItem,
  AdminProductVisibilityStatus,
} from '#shared/types/admin_product'
import type { TranslationLocale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'

interface TransformOptions {
  names: Map<number, string>
  visibilityStatuses: Map<number, AdminProductVisibilityStatus>
  locale: TranslationLocale
}

/**
 * Ligne de la liste des produits du back-office.
 */
export default class AdminProductTransformer extends BaseTransformer<Product> {
  constructor(
    resource: Product,
    private options: TransformOptions
  ) {
    super(resource)
  }

  toObject(): AdminProductListItem {
    const { names, visibilityStatuses, locale } = this.options

    // Nom du fournisseur
    const supplierResolved = resolveTranslation(this.resource.supplier?.translations, locale, {
      fallback: 'fr',
    })
    const supplierName =
      supplierResolved?.name ?? this.resource.supplier?.organization?.name ?? null

    // Nom de la categorie
    const categoryResolved = this.resource.category
      ? resolveTranslation(this.resource.category.translations, locale, {
          sourceLocale: this.resource.category.sourceLocale,
          fallback: 'fr',
        })
      : null

    return {
      id: this.resource.id,
      name: names.get(this.resource.id) ?? null,
      slug: this.resource.slug,
      supplierName,
      supplierOrganizationId: this.resource.supplier?.organizationId ?? null,
      categoryName: categoryResolved?.name ?? null,
      visibilityStatus: visibilityStatuses.get(this.resource.id) ?? 'unpublished',
      variantsCount: Number(this.resource.$extras.variants_count ?? 0),
      imagesCount: Number(this.resource.$extras.images_count ?? 0),
      stockStatus: this.resource.stockStatus,
      createdAt: this.resource.createdAt.toISO()!,
    }
  }
}
