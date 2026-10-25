import { BaseTransformer } from '@adonisjs/core/transformers'
import { RfqNotFoundException } from '#exceptions/rfq_errors'
import type Rfq from '#models/rfq'
import { RFQ_DEADLINE_TIMEZONE, type SupplierRfqType } from '#shared/types/rfq'

/**
 * Ligne « demandes reçues », vue du fournisseur. Suppose la demande chargée
 * par `RfqService#listForSupplier` / `findForSupplier` : `buyerOrganization` et
 * `items` préchargés, et `suppliers` **restreint au fournisseur courant** —
 * c'est cette unique ligne qui porte `myStatus`.
 *
 * Le budget plafond de l'acheteur n'est jamais exposé ici (cf.
 * `SupplierRfqType`).
 */
export default class SupplierRfqTransformer extends BaseTransformer<Rfq> {
  toObject(): SupplierRfqType {
    return {
      ...this.pick(this.resource, ['id', 'title', 'status']),
      deadline: this.resource.deadline?.setZone(RFQ_DEADLINE_TIMEZONE).toISO() ?? null,
      itemCount: this.resource.items.length,
      buyerName: this.resource.buyerOrganization.name,
      buyerLogoUrl: this.resource.buyerOrganization.logoUrl,
      myStatus: this.recipient.status,
      sentAt: this.recipient.sentAt?.toISO() ?? null,
      publishedAt: this.resource.publishedAt?.toISO() ?? null,
    }
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
