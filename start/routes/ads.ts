import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

/**
 * Produits sponsorisés (cf. `docs/ads.md`). Quatre groupes de routes, chacun
 * appelé là où `start/routes.ts` pose les bonnes gardes.
 */

/**
 * Lien de clic d'un produit sponsorisé : **public**, dans le groupe préfixé par
 * la locale. Authentifié par la signature de l'URL.
 */
export function registerAdClickRoutes(): void {
  router
    .get('ads/click/:id', [controllers.AdClicks, 'show'])
    .where('id', router.matchers.number())
    .as('ads.click')
}

/** Espace fournisseur : dans le groupe `auth` + `emailVerified` + `onboarded`. */
export function registerSupplierAdRoutes(): void {
  router.get('supplier/ads', [controllers.supplier.AdCampaign, 'index']).as('supplier.ads.index')
  router
    .get('supplier/ads/new', [controllers.supplier.AdCampaign, 'create'])
    .as('supplier.ads.create')
  router.post('supplier/ads', [controllers.supplier.AdCampaign, 'store']).as('supplier.ads.store')
  router
    .post('supplier/ads/wallet/top-up', [controllers.supplier.AdWallet, 'topUp'])
    .as('supplier.ads.wallet.top_up')
  router
    .get('supplier/ads/:id/edit', [controllers.supplier.AdCampaign, 'edit'])
    .where('id', router.matchers.number())
    .as('supplier.ads.edit')
  router
    .patch('supplier/ads/:id', [controllers.supplier.AdCampaign, 'update'])
    .where('id', router.matchers.number())
    .as('supplier.ads.update')
  router
    .patch('supplier/ads/:id/status', [controllers.supplier.AdCampaign, 'updateStatus'])
    .where('id', router.matchers.number())
    .as('supplier.ads.status')
  router
    .delete('supplier/ads/:id', [controllers.supplier.AdCampaign, 'destroy'])
    .where('id', router.matchers.number())
    .as('supplier.ads.destroy')
}

/** Back-office : dans le groupe réservé à l'équipe plateforme. */
export function registerAdminAdRoutes(): void {
  router.get('admin/ads', [controllers.admin.Ad, 'index']).as('admin.ads.index')
  router
    .post('admin/ads/wallets/adjust', [controllers.admin.Ad, 'adjustWallet'])
    .as('admin.ads.wallets.adjust')
  router
    .post('admin/ads/:id/suspend', [controllers.admin.Ad, 'suspend'])
    .where('id', router.matchers.number())
    .as('admin.ads.suspend')
  router
    .post('admin/ads/:id/restore', [controllers.admin.Ad, 'restore'])
    .where('id', router.matchers.number())
    .as('admin.ads.restore')
}

/**
 * Notifications de paiement : hors locale et hors session, exemptée de CSRF
 * (`config/shield.ts`). Authentifiée par la signature de Stripe.
 */
export function registerAdWebhookRoutes(): void {
  router.post('webhooks/stripe', [controllers.StripeWebhook, 'store']).as('webhooks.stripe')
}
