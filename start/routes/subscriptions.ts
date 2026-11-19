import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Abonnements fournisseurs (cf. `docs/abonnements.md`). Espace fournisseur :
 * dans le groupe `auth` + `emailVerified` + `onboarded`. Les notifications
 * Stripe arrivent sur `webhooks/stripe` (`start/routes/ads.ts`), partagé avec
 * les recharges publicitaires.
 */
export function registerSupplierSubscriptionRoutes(): void {
  router
    .get('supplier/subscription', [controllers.supplier.Subscription, 'show'])
    .as('supplier.subscription.show')
  router
    .post('supplier/subscription/checkout', [controllers.supplier.Subscription, 'checkout'])
    .as('supplier.subscription.checkout')
  router
    .post('supplier/subscription/portal', [controllers.supplier.Subscription, 'portal'])
    .as('supplier.subscription.portal')
}
