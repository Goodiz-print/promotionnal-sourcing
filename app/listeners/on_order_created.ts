import { inject } from '@adonisjs/core'
import InAppNotificationService from '#services/in_app_notification_service'
import type OrderCreated from '#events/order_created'

/** Une commande vient d'être créée : le fournisseur est prévenu de confirmer. */
@inject()
export default class OnOrderCreated {
  constructor(private inApp: InAppNotificationService) {}

  async handle({ order }: OrderCreated) {
    await this.inApp.orderChanged(order, 'order.created', 'supplier')
  }
}
