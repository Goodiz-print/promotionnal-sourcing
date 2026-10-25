import { inject } from '@adonisjs/core'
import OrderService from '#services/order_service'
import type QuoteAccepted from '#events/quote_accepted'

/**
 * L'acheteur a accepté un devis : la commande est créée (#6). Idempotent — voir
 * `OrderService#createFromQuote`.
 */
@inject()
export default class OnQuoteAcceptedCreateOrder {
  constructor(private orders: OrderService) {}

  async handle({ quote }: QuoteAccepted) {
    await this.orders.createFromQuote(quote)
  }
}
