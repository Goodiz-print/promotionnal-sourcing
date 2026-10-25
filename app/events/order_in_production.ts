import type Order from '#models/order'

/** Commande in production — voir `OrderService`. */
export default class OrderInProduction {
  constructor(public order: Order) {}
}
