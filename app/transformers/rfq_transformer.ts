import { BaseTransformer } from '@adonisjs/core/transformers'
import type Rfq from '#models/rfq'
import { RFQ_DEADLINE_TIMEZONE, type RfqType } from '#shared/types/rfq'

/**
 * Ligne de la liste « mes demandes ». Suppose `items` et `suppliers`
 * préchargés : on n'expose que leurs compteurs, l'écran de liste n'ayant pas
 * besoin du détail.
 */
export default class RfqTransformer extends BaseTransformer<Rfq> {
  toObject(): RfqType {
    return {
      ...this.pick(this.resource, ['id', 'title', 'status', 'budgetMax']),
      batchId: this.resource.batchId ?? null,
      deadline: this.resource.deadline?.setZone(RFQ_DEADLINE_TIMEZONE).toISO() ?? null,
      itemCount: this.resource.items.length,
      supplierCount: this.resource.suppliers.length,
      respondedCount: this.resource.suppliers.filter((row) => row.status === 'responded').length,
      publishedAt: this.resource.publishedAt?.toISO() ?? null,
      closedAt: this.resource.closedAt?.toISO() ?? null,
      expiredAt: this.resource.expiredAt?.toISO() ?? null,
      createdAt: this.resource.createdAt.toISO()!,
    }
  }
}
