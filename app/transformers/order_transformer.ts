import { BaseTransformer } from '@adonisjs/core/transformers'
import { RFQ_DEADLINE_TIMEZONE } from '#shared/types/rfq'
import type Order from '#models/order'
import type { OrderAction, OrderSide, OrderType } from '#shared/types/order'
import type { DateTime } from 'luxon'

/** Date ISO dans le fuseau d'affichage, `null` si le statut n'est pas atteint. */
function iso(value: DateTime | null): string | null {
  return value?.setZone(RFQ_DEADLINE_TIMEZONE).toISO() ?? null
}

/**
 * Commande, côté acheteur comme côté fournisseur. Suppose `quote` (avec `rfq`),
 * les deux organisations et `items` préchargés par `OrderService`. `actions`
 * est calculé par le service (`availableActions`) et passé ici : le transformer
 * ne décide rien. Les montants `numeric` (chaînes côté Lucid) sortent en nombres.
 */
export default class OrderTransformer extends BaseTransformer<Order> {
  constructor(
    resource: Order,
    protected actions: OrderAction[] = [],
    protected side: OrderSide = 'buyer'
  ) {
    super(resource)
  }

  toObject(): OrderType {
    const { resource } = this

    return {
      ...this.pick(resource, [
        'id',
        'quoteId',
        'status',
        'currency',
        'shippingAddress',
        'billingAddress',
      ]),
      rfqId: resource.quote.rfqId,
      rfqTitle: resource.quote.rfq.title,
      buyerName: resource.buyerOrganization.name,
      supplierName: resource.supplierOrganization.name,
      totalAmount: Number(resource.totalAmount),
      timeline: {
        createdAt: resource.createdAt.setZone(RFQ_DEADLINE_TIMEZONE).toISO()!,
        confirmedAt: iso(resource.confirmedAt),
        inProductionAt: iso(resource.inProductionAt),
        shippedAt: iso(resource.shippedAt),
        deliveredAt: iso(resource.deliveredAt),
        cancelledAt: iso(resource.cancelledAt),
      },
      actions: this.actions,
      items: resource.items.map((item) => ({
        id: item.id,
        name: item.name,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        customizationDetails: item.customizationDetails,
      })),
    }
  }
}
