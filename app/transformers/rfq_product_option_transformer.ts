import { BaseTransformer } from '@adonisjs/core/transformers'
import type Product from '#models/product'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import { resolveTranslation } from '#shared/helpers/translations'
import type { RfqProductOptionType } from '#shared/types/rfq'

/**
 * Produit réduit à ce que le formulaire de demande utilise. Attend
 * `translations` et `supplier.organization` préchargés (cf.
 * `ProductCatalogueService#findForRfq` / `#lookupForRfq`).
 *
 * `name` retombe sur le slug quand aucune traduction n'existe : une ligne de
 * demande exige une désignation, et le slug est toujours là.
 */
export default class RfqProductOptionTransformer extends BaseTransformer<Product> {
  constructor(
    resource: Product,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): RfqProductOptionType {
    const translation = resolveTranslation(this.resource.translations, this.locale)
    const organization = this.resource.supplier?.organization

    return {
      id: this.resource.id,
      slug: this.resource.slug,
      name: translation?.name ?? this.resource.slug,
      categoryId: this.resource.categoryId ?? null,
      minQuantity: this.resource.minQuantity ?? null,
      supplierName: organization?.name ?? null,
      supplierOrganizationId: organization?.id ?? null,
    }
  }
}
