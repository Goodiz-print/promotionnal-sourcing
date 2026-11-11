import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Panier de devis (cf. `docs/quote-cart.md`). Appelé depuis `start/routes.ts`,
 * **à l'intérieur** du groupe préfixé par la locale et gardé par `auth` +
 * `onboarded`, comme `registerRfqRoutes`.
 */
export function registerQuoteCartRoutes(): void {
  router.get('quote-cart', [controllers.QuoteCart, 'show']).as('quote_cart.show')
  router.post('quote-cart/items', [controllers.QuoteCart, 'store']).as('quote_cart.items.store')
  router
    .patch('quote-cart/items/:id', [controllers.QuoteCart, 'update'])
    .as('quote_cart.items.update')
  router
    .delete('quote-cart/items/:id', [controllers.QuoteCart, 'destroy'])
    .as('quote_cart.items.destroy')
  router.post('quote-cart/checkout', [controllers.QuoteCart, 'checkout']).as('quote_cart.checkout')
}
