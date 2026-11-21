import RfqItemTransformer from '#transformers/rfq_item_transformer'
import SupplierRfqTransformer from '#transformers/supplier_rfq_transformer'
import { buyerContactOf } from '#shared/helpers/buyer_contact'
import { DEFAULT_LOCALE, type Locale } from '#shared/types/i18n'
import type Rfq from '#models/rfq'
import type { BuyerContactType, SupplierRfqDetailType } from '#shared/types/rfq'

/**
 * Détail d'une demande reçue : la ligne de liste, plus le besoin complet. Les
 * autres destinataires ne sont pas exposés — un fournisseur consulté n'a pas à
 * savoir qui d'autre l'est, ni qui a déjà répondu.
 *
 * Un fournisseur abonné reçoit aussi les coordonnées de l'agence (#221) ; elles
 * supposent `createdBy` préchargé (`RfqService#findForSupplier`).
 */
export default class SupplierRfqDetailTransformer extends SupplierRfqTransformer {
  constructor(
    resource: Rfq,
    revealBuyer = false,
    protected locale: Locale = DEFAULT_LOCALE
  ) {
    super(resource, revealBuyer)
  }

  toObject(): SupplierRfqDetailType {
    return {
      ...super.toObject(),
      description: this.resource.description,
      items: this.resource.items.map((item) =>
        new RfqItemTransformer(item, this.locale).toObject()
      ),
      buyerContact: this.buyerContact,
    }
  }

  /** Coordonnées de l'agence, ou rien pour un fournisseur non abonné (#220). */
  protected get buyerContact(): BuyerContactType | null {
    if (!this.revealBuyer) return null
    const requester = this.resource.createdBy
    return buyerContactOf(
      {
        organization: this.resource.buyerOrganization,
        requester: requester ? { fullName: requester.fullName, email: requester.email } : null,
      },
      this.locale
    )
  }
}
