import type Supplier from '#models/supplier'
import { BaseTransformer } from '@adonisjs/core/transformers'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import SupplierTransformer from '#transformers/supplier_transformer'
import ProductTransformer from '#transformers/product_transformer'
import SupplierProfileTransformer from '#transformers/supplier_profile_transformer'
import type { SupplierDetailType } from '#shared/types/supplier'

/**
 * Fiche fournisseur détaillée pour l'annuaire public : la fiche localisée +
 * le profil fournisseur (si l'organisation est liée) + le catalogue produits.
 * Requiert `translations`, `products.translations` et
 * `organization.supplierProfile` préchargés.
 */
export default class SupplierDetailTransformer extends BaseTransformer<Supplier> {
  constructor(
    resource: Supplier,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): SupplierDetailType {
    const profile = this.resource.organization?.supplierProfile

    return {
      ...new SupplierTransformer(this.resource, this.locale).toObject(),
      supplierProfile: profile ? new SupplierProfileTransformer(profile).toObject() : null,
      products: this.resource.products.map((product) =>
        new ProductTransformer(product, this.locale).toObject()
      ),
    }
  }
}
