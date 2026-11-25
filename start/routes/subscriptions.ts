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

/**
 * Abonnements manuels saisis depuis la fiche admin d'une organisation (#214).
 * Dans le groupe du back-office ; le contrôleur autorise `organizations.manage`.
 */
export function registerAdminSubscriptionRoutes(): void {
  router
    .post('admin/organizations/:id/subscriptions', [
      controllers.admin.OrganizationSubscription,
      'store',
    ])
    .where('id', router.matchers.number())
    .as('admin.organizations.subscriptions.store')
  router
    .patch('admin/organizations/:id/subscriptions/:subscriptionId', [
      controllers.admin.OrganizationSubscription,
      'extend',
    ])
    .where('id', router.matchers.number())
    .where('subscriptionId', router.matchers.number())
    .as('admin.organizations.subscriptions.extend')
  router
    .post('admin/organizations/:id/subscriptions/:subscriptionId/cancel', [
      controllers.admin.OrganizationSubscription,
      'cancel',
    ])
    .where('id', router.matchers.number())
    .where('subscriptionId', router.matchers.number())
    .as('admin.organizations.subscriptions.cancel')
}
