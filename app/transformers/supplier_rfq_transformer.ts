import { BaseTransformer } from '@adonisjs/core/transformers'
import { RfqNotFoundException } from '#exceptions/rfq_errors'
import type Rfq from '#models/rfq'
import { supplierRfqState } from '#shared/helpers/supplier_rfq'
import { RFQ_DEADLINE_TIMEZONE, type SupplierRfqType } from '#shared/types/rfq'

/**
 * Ligne « demandes reçues », vue du fournisseur. Suppose la demande chargée
 * par `RfqService#listForSupplier` / `findForSupplier` : `buyerOrganization`
 * préchargée, `items` préchargés ou comptés (`$extras.itemsCount`), et `suppliers` **restreint au fournisseur courant** —
 * c'est cette unique ligne qui porte `myStatus`.
 *
 * Le budget plafond de l'acheteur n'est jamais exposé ici (cf.
 * `SupplierRfqType`). L'agence ne l'est que si `revealBuyer` (fournisseur
 * abonné, #220) : par défaut, la demande reste anonyme.
 */
export default class SupplierRfqTransformer extends BaseTransformer<Rfq> {
  constructor(
    resource: Rfq,
    protected revealBuyer = false
  ) {
    super(resource)
  }

  toObject(): SupplierRfqType {
    return {
      ...this.pick(this.resource, ['id', 'title', 'status']),
      deadline: this.resource.deadline?.setZone(RFQ_DEADLINE_TIMEZONE).toISO() ?? null,
      itemCount: this.itemCount,
      ...this.buyer,
      myStatus: this.recipient.status,
      myState: supplierRfqState(this.recipient.status),
      myLateReply: this.recipient.lateReplyAt !== null,
      sentAt: this.recipient.sentAt?.toISO() ?? null,
      publishedAt: this.resource.publishedAt?.toISO() ?? null,
    }
  }

  /**
   * Nombre de lignes : compté en sous-requête par la liste
   * (`$extras.itemsCount`), sinon les items préchargés du détail.
   */
  protected get itemCount(): number {
    const counted = this.resource.$extras.itemsCount
    return counted === undefined ? this.resource.items.length : Number(counted)
  }

  /** Nom et logo de l'agence, ou rien pour un fournisseur non abonné. */
  protected get buyer(): Pick<SupplierRfqType, 'buyerName' | 'buyerLogoUrl'> {
    if (!this.revealBuyer) return { buyerName: null, buyerLogoUrl: null }
    const { name, logoUrl } = this.resource.buyerOrganization
    return { buyerName: name, buyerLogoUrl: logoUrl }
  }

  /**
   * La ligne `rfq_suppliers` du fournisseur courant. Son absence signifie que
   * la requête n'a pas filtré `suppliers` sur lui : mieux vaut un 404 qu'une
   * demande affichée sans savoir à qui elle s'adresse.
   */
  protected get recipient() {
    const [recipient] = this.resource.suppliers
    if (!recipient) throw new RfqNotFoundException()
    return recipient
  }
}
