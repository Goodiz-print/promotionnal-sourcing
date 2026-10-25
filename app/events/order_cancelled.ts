import type Order from '#models/order'
import type { OrderSide } from '#shared/types/order'

/** Commande annulée par l'un des deux côtés — voir `OrderService`. */
export default class OrderCancelled {
  constructor(
    public order: Order,
    public cancelledBy: OrderSide
  ) {}
}
