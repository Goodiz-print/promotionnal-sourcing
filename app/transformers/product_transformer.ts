import type Product from '#models/product'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { ProductType } from '#shared/types/product'

export default class ProductTransformer extends BaseTransformer<Product> {
  constructor(
    resource: Product,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): ProductType {
    // Contenu localisé : résolu depuis `translations` préchargé (repli locale
    // par défaut). `embedding` n'est jamais exposé.
    const translation = resolveTranslation(this.resource.translations, this.locale)

    return {
      ...this.pick(this.resource, [
        'id',
        'supplierId',
        'categoryId',
        'slug',
        'reference',
        'priceMin',
        'priceMax',
        'currency',
        'minQuantity',
        'imageUrl',
        'originCountry',
        'madeInEurope',
        'isActive',
      ]),
      name: translation?.name ?? null,
      description: translation?.description ?? null,
      createdAt: this.resource.createdAt.toISO()!,
      updatedAt: this.resource.updatedAt?.toISO() ?? null,
    }
  }
}
