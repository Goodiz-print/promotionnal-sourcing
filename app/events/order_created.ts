import type Order from '#models/order'

/** Commande created — voir `OrderService`. */
export default class OrderCreated {
  constructor(public order: Order) {}
}
