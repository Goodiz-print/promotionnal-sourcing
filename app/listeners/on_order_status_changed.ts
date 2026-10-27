import { inject } from '@adonisjs/core'
import InAppNotificationService from '#services/in_app_notification_service'
import OrderCancelled from '#events/order_cancelled'
import OrderConfirmed from '#events/order_confirmed'
import OrderDelivered from '#events/order_delivered'
import OrderInProduction from '#events/order_in_production'
import OrderShipped from '#events/order_shipped'
import type { OrderSide } from '#shared/types/order'
import type { OrderNotificationType } from '#shared/types/notification'

type StatusEvent =
  OrderConfirmed | OrderInProduction | OrderShipped | OrderDelivered | OrderCancelled

/**
 * Qui est prévenu de quoi : l'acheteur suit l'avancement du fournisseur, le
 * fournisseur apprend la livraison, et une annulation prévient l'autre côté.
 */
function describe(event: StatusEvent): { type: OrderNotificationType; recipient: OrderSide } {
  if (event instanceof OrderConfirmed) return { type: 'order.confirmed', recipient: 'buyer' }
  if (event instanceof OrderInProduction) return { type: 'order.in_production', recipient: 'buyer' }
  if (event instanceof OrderShipped) return { type: 'order.shipped', recipient: 'buyer' }
  if (event instanceof OrderDelivered) return { type: 'order.delivered', recipient: 'supplier' }
  return {
    type: 'order.cancelled',
    recipient: event.cancelledBy === 'buyer' ? 'supplier' : 'buyer',
  }
}

/** Une même classe écoute tous les changements de statut (voir `start/events.ts`). */
@inject()
export default class OnOrderStatusChanged {
  constructor(private inApp: InAppNotificationService) {}

  async handle(event: StatusEvent) {
    const { type, recipient } = describe(event)
    await this.inApp.orderChanged(event.order, type, recipient)
  }
}
