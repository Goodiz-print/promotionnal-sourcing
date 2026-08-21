import type Rfq from '#models/rfq'
import RfqTransformer from '#transformers/rfq_transformer'
import RfqItemTransformer from '#transformers/rfq_item_transformer'
import RfqSupplierTransformer from '#transformers/rfq_supplier_transformer'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import type { RfqDetailType } from '#shared/types/rfq'

/**
 * Écran de détail : la ligne de liste, plus le besoin complet et l'avancement
 * par destinataire.
 */
export default class RfqDetailTransformer extends RfqTransformer {
  constructor(
    resource: Rfq,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): RfqDetailType {
    return {
      ...super.toObject(),
      description: this.resource.description,
      createdByName: this.resource.createdBy?.fullName ?? null,
      items: this.resource.items.map((item) =>
        new RfqItemTransformer(item, this.locale).toObject()
      ),
      suppliers: this.resource.suppliers.map((row) => new RfqSupplierTransformer(row).toObject()),
    }
  }
}
