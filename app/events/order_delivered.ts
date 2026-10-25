import type Order from '#models/order'

/** Commande delivered — voir `OrderService`. */
export default class OrderDelivered {
  constructor(public order: Order) {}
}
