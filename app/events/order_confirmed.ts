import type Order from '#models/order'

/** Commande confirmed — voir `OrderService`. */
export default class OrderConfirmed {
  constructor(public order: Order) {}
}
