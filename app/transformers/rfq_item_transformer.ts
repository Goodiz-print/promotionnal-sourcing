import { BaseTransformer } from '@adonisjs/core/transformers'
import type RfqItem from '#models/rfq_item'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { RfqItemType } from '#shared/types/rfq'

/**
 * Ligne de besoin. `categoryName`/`productName` sont résolus dans la locale
 * active quand l'item référence le catalogue — l'acheteur voit le libellé, pas
 * un identifiant. `name` reste porté par l'item : il survit à la suppression du
 * produit référencé (FK en `SET NULL`).
 */
export default class RfqItemTransformer extends BaseTransformer<RfqItem> {
  constructor(
    resource: RfqItem,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): RfqItemType {
    const category = this.resource.category
      ? resolveTranslation(
          this.resource.category.translations,
          this.locale,
          this.resource.category.sourceLocale
        )
      : null
    const product = this.resource.product
      ? resolveTranslation(
          this.resource.product.translations,
          this.locale,
          this.resource.product.sourceLocale
        )
      : null

    return {
      ...this.pick(this.resource, [
        'id',
        'name',
        'description',
        'quantity',
        'unit',
        'categoryId',
        'productId',
      ]),
      categoryName: category?.name ?? null,
      productName: product?.name ?? null,
      productSlug: this.resource.product?.slug ?? null,
      specs: this.resource.specs,
    }
  }
}
