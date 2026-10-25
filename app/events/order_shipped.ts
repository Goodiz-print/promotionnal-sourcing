import type Order from '#models/order'

/** Commande shipped — voir `OrderService`. */
export default class OrderShipped {
  constructor(public order: Order) {}
}
