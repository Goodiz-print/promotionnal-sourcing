import RfqItemTransformer from '#transformers/rfq_item_transformer'
import SupplierRfqTransformer from '#transformers/supplier_rfq_transformer'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import type Rfq from '#models/rfq'
import type { SupplierRfqDetailType } from '#shared/types/rfq'

/**
 * Détail d'une demande reçue : la ligne de liste, plus le besoin complet. Les
 * autres destinataires ne sont pas exposés — un fournisseur consulté n'a pas à
 * savoir qui d'autre l'est, ni qui a déjà répondu.
 */
export default class SupplierRfqDetailTransformer extends SupplierRfqTransformer {
  constructor(
    resource: Rfq,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource)
  }

  toObject(): SupplierRfqDetailType {
    return {
      ...super.toObject(),
      description: this.resource.description,
      items: this.resource.items.map((item) =>
        new RfqItemTransformer(item, this.locale).toObject()
      ),
    }
  }
}
