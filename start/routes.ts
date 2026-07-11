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

        // Écrans nécessitant une organisation : gardés par `onboarded`.
        router
          .group(() => {
            router
              .get('supplier/profile', [controllers.supplier.Profile, 'show'])
              .as('supplier.profile')
            router
              .patch('supplier/profile', [controllers.supplier.Profile, 'update'])
              .as('supplier.profile.update')
          })
          .use(middleware.onboarded())
      })
      .use(middleware.auth())
  })
  .prefix(':locale')
  .where('locale', /^(fr|en)$/)
