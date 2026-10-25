import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Commandes (#6) : les deux côtés du domaine.
 *
 * Appelé depuis `start/routes.ts`, **à l'intérieur** du groupe préfixé par la
 * locale et gardé par `auth` + `onboarded`, comme `registerQuoteRoutes`. Une
 * commande n'est jamais créée par une route : elle naît de l'acceptation d'un
 * devis (listener de `QuoteAccepted`).
 */
export function registerOrderRoutes(): void {
  // Acheteur : suivre, confirmer la réception, annuler.
  router.get('orders', [controllers.Orders, 'index']).as('orders.index')
  router.get('orders/:id', [controllers.Orders, 'show']).as('orders.show')
  router.patch('orders/:id/deliver', [controllers.Orders, 'deliver']).as('orders.deliver')
  router.patch('orders/:id/cancel', [controllers.Orders, 'cancel']).as('orders.cancel')

  // Fournisseur : faire avancer le statut.
  router.get('supplier/orders', [controllers.supplier.Orders, 'index']).as('supplier.orders.index')
  router
    .get('supplier/orders/:id', [controllers.supplier.Orders, 'show'])
    .as('supplier.orders.show')
  router
    .patch('supplier/orders/:id/confirm', [controllers.supplier.Orders, 'confirm'])
    .as('supplier.orders.confirm')
  router
    .patch('supplier/orders/:id/produce', [controllers.supplier.Orders, 'produce'])
    .as('supplier.orders.produce')
  router
    .patch('supplier/orders/:id/ship', [controllers.supplier.Orders, 'ship'])
    .as('supplier.orders.ship')
  router
    .patch('supplier/orders/:id/cancel', [controllers.supplier.Orders, 'cancel'])
    .as('supplier.orders.cancel')
}
