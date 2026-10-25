import { BaseTransformer } from '@adonisjs/core/transformers'
import { RFQ_DEADLINE_TIMEZONE } from '#shared/types/rfq'
import type Quote from '#models/quote'
import type { QuoteType } from '#shared/types/quote'

/**
 * Devis, côté acheteur comme côté fournisseur. Suppose `rfq`,
 * `supplierOrganization` et `items` (avec `rfqItem`) préchargés par
 * `QuoteService`. Les montants `numeric` (chaînes côté Lucid) sortent en
 * nombres ; `validUntil` en `AAAA-MM-JJ`.
 */
export default class QuoteTransformer extends BaseTransformer<Quote> {
  toObject(): QuoteType {
    const { resource } = this
    const items = resource.items.map((item) => ({
      id: item.id,
      rfqItemId: item.rfqItemId,
      rfqItemName: item.rfqItem.name,
      productId: item.productId,
      unitPrice: Number(item.unitPrice),
      quantity: item.quantity,
      totalPrice: Number(item.totalPrice),
      leadTimeDays: item.leadTimeDays,
      customizationDetails: item.customizationDetails,
    }))

    return {
      ...this.pick(resource, ['id', 'rfqId', 'status', 'notes', 'currency']),
      rfqTitle: resource.rfq.title,
      supplierOrganizationId: resource.supplierOrganizationId,
      supplierName: resource.supplierOrganization.name,
      validUntil: resource.validUntil?.toISODate() ?? null,
      totalAmount: Number(resource.totalAmount),
      submittedAt: resource.submittedAt?.setZone(RFQ_DEADLINE_TIMEZONE).toISO() ?? null,
      decidedAt: resource.decidedAt?.setZone(RFQ_DEADLINE_TIMEZONE).toISO() ?? null,
      leadTimeDays: Math.max(0, ...items.map((item) => item.leadTimeDays)),
      items,
    }
  }
}
