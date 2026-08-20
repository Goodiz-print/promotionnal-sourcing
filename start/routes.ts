/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import transmit from '@adonisjs/transmit/services/main'
import type { HttpContext } from '@adonisjs/core/http'

transmit.registerRoutes()

/**
 * La racine redirige vers la locale détectée (préfixe d'URL /:locale).
 * `ctx.i18n.locale` a déjà été résolu par detect_user_locale (cookie,
 * préférence utilisateur, Accept-Language, défaut).
 */
router.get('/', ({ i18n, response }: HttpContext) => response.redirect(`/${i18n.locale}`))

/**
 * Changement de langue : persiste le choix (cookie + utilisateur) puis
 * redirige vers l'URL préfixée de la nouvelle langue. Hors préfixe.
 */
router.post('locale', [controllers.Locale, 'update']).as('locale.update')

/**
 * Toutes les routes applicatives vivent sous un préfixe de locale
 * (`/fr`, `/en`). La contrainte `where` rejette toute locale non
 * supportée (=> 404) ; le middleware bascule `ctx.i18n` sur cette locale.
 */
router
  .group(() => {
    router.on('/').renderInertia('home', {}).as('home')

    // Annuaire public des fournisseurs (sans auth).
    router.get('suppliers', [controllers.Suppliers, 'index']).as('suppliers.index')
    router.get('suppliers/:slug', [controllers.Suppliers, 'show']).as('suppliers.show')

    // Catalogue public des produits (sans auth).
    router.get('products', [controllers.Products, 'index']).as('products.index')
    router.get('products/:slug', [controllers.Products, 'show']).as('products.show')

    // Aperçu public d'une invitation (URL signée, sans auth requise).
    router
      .get('organization/invitations/:id/accept', [
        controllers.organization.InvitationAcceptance,
        'show',
      ])
      .as('organization.invitations.show')

    router
      .group(() => {
        router.get('signup', [controllers.NewAccount, 'create'])
        router.post('signup', [controllers.NewAccount, 'store'])

        router.get('login', [controllers.Session, 'create'])
        router.post('login', [controllers.Session, 'store'])
      })
      .use(middleware.guest())

    router
      .group(() => {
        router.post('logout', [controllers.Session, 'destroy'])

        router.get('onboarding', [controllers.Onboarding, 'show']).as('onboarding.show')
        router.post('onboarding', [controllers.Onboarding, 'store']).as('onboarding.store')

        // Acceptation d'une invitation : hors `onboarded`, un invité sans
        // organisation ne doit pas être bloqué vers l'onboarding avant d'avoir
        // pu accepter (même exemption que onboarding/logout ci-dessus).
        router
          .post('organization/invitations/:id/accept', [
            controllers.organization.InvitationAcceptance,
            'accept',
          ])
          .as('organization.invitations.accept')

        // Écrans nécessitant une organisation : gardés par `onboarded`.
        router
          .group(() => {
            // Paramètres généraux de l'organisation courante (nom, coordonnées, logo).
            router
              .get('organization/settings', [controllers.organization.Settings, 'show'])
              .as('organization.settings')
            // POST (et non PATCH) pour porter le corps multipart de l'upload du logo.
            router
              .post('organization/settings', [controllers.organization.Settings, 'update'])
              .as('organization.settings.update')

            // Gestion des membres de l'organisation courante (rôle, retrait).
            router
              .get('organization/members', [controllers.organization.Members, 'index'])
              .as('organization.members')
            router
              .patch('organization/members/:id', [controllers.organization.Members, 'update'])
              .as('organization.members.update')
            router
              .delete('organization/members/:id', [controllers.organization.Members, 'destroy'])
              .as('organization.members.destroy')

            // Invitation de nouveaux membres par email (owner/admin/manager).
            router
              .post('organization/invitations', [controllers.organization.Invitations, 'store'])
              .as('organization.invitations.store')
            router
              .post('organization/invitations/:id/resend', [
                controllers.organization.Invitations,
                'resend',
              ])
              .as('organization.invitations.resend')
            router
              .delete('organization/invitations/:id', [
                controllers.organization.Invitations,
                'destroy',
              ])
              .as('organization.invitations.destroy')

            router
              .get('supplier/profile', [controllers.supplier.Profile, 'show'])
              .as('supplier.profile')
            router
              .patch('supplier/profile', [controllers.supplier.Profile, 'update'])
              .as('supplier.profile.update')

            // Gestion des produits par le fournisseur (CRUD + upload images).
            router
              .get('supplier/products', [controllers.supplier.Product, 'index'])
              .as('supplier.products.index')
            router
              .get('supplier/products/new', [controllers.supplier.Product, 'create'])
              .as('supplier.products.create')
            router
              .post('supplier/products', [controllers.supplier.Product, 'store'])
              .as('supplier.products.store')
            router
              .get('supplier/products/:id/edit', [controllers.supplier.Product, 'edit'])
              .as('supplier.products.edit')
            // POST (et non PATCH) pour porter le corps multipart de l'upload.
            router
              .post('supplier/products/:id', [controllers.supplier.Product, 'update'])
              .as('supplier.products.update')
            router
              .delete('supplier/products/:id', [controllers.supplier.Product, 'destroy'])
              .as('supplier.products.destroy')

            // Administration de la taxonomie du catalogue (catégories globales).
            router
              .get('admin/categories', [controllers.admin.Category, 'index'])
              .as('admin.categories.index')
            router
              .get('admin/categories/new', [controllers.admin.Category, 'create'])
              .as('admin.categories.create')
            router
              .post('admin/categories', [controllers.admin.Category, 'store'])
              .as('admin.categories.store')
            router
              .get('admin/categories/:id/edit', [controllers.admin.Category, 'edit'])
              .as('admin.categories.edit')
            router
              .patch('admin/categories/:id', [controllers.admin.Category, 'update'])
              .as('admin.categories.update')
            router
              .delete('admin/categories/:id', [controllers.admin.Category, 'destroy'])
              .as('admin.categories.destroy')
          })
          .use(middleware.onboarded())
      })
      .use(middleware.auth())
  })
  .prefix(':locale')
  .where('locale', /^(fr|en)$/)
