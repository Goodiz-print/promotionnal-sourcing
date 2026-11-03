/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import {
  emailVerificationResendThrottle,
  imageSearchThrottle,
  loginThrottle,
  passkeyLoginThrottle,
  passwordResetThrottle,
  signupThrottle,
} from '#start/limiter'
import { registerRfqRoutes } from '#start/routes/rfqs'
import { registerQuoteRoutes } from '#start/routes/quotes'
import { registerOrderRoutes } from '#start/routes/orders'
import { registerNotificationRoutes } from '#start/routes/notifications'
import { registerDocumentRoutes } from '#start/routes/documents'
import { registerHealthRoutes } from '#start/routes/health'
import { registerMarketingRoutes, registerMarketingLegacyRoutes } from '#start/routes/marketing'
import { LOCALE_ROUTE_PATTERN } from '#shared/types/i18n'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'
import transmit from '@adonisjs/transmit/services/main'
import type { HttpContext } from '@adonisjs/core/http'

transmit.registerRoutes()

registerMarketingLegacyRoutes()

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

registerHealthRoutes()

/**
 * Toutes les routes applicatives vivent sous un préfixe de locale
 * (`/fr`, `/en`). La contrainte `where` rejette toute locale non
 * supportée (=> 404) ; le middleware bascule `ctx.i18n` sur cette locale.
 */
router
  .group(() => {
    // Landing : accueil et pages publiques (contact, légal, confidentialité).
    router.get('/', [controllers.Marketing, 'home']).as('home')
    registerMarketingRoutes()

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

    // Lien de vérification d'email reçu par mail : URL signée, hors `auth` (peut
    // être ouvert depuis un autre navigateur que celui de l'inscription).
    router.get('email/verify/:id', [controllers.EmailVerification, 'verify']).as('email.verify')

    router
      .group(() => {
        router.get('signup', [controllers.NewAccount, 'create'])
        router.post('signup', [controllers.NewAccount, 'store']).use(signupThrottle)

        // Inscription agence : compte utilisateur + organisation acheteur en une étape.
        router.get('signup/agency', [controllers.AgencySignup, 'create']).as('agency_signup.create')
        router
          .post('signup/agency', [controllers.AgencySignup, 'store'])
          .as('agency_signup.store')
          .use(signupThrottle)

        router.get('login', [controllers.Session, 'create'])
        router.post('login', [controllers.Session, 'store']).use(loginThrottle)

        // Connexion par passkey : `options` émet le défi, `login` vérifie la signature.
        router
          .get('passkeys/options', [controllers.PasskeySession, 'options'])
          .as('passkey.login.options')
        router
          .post('passkeys/login', [controllers.PasskeySession, 'store'])
          .as('passkey.login')
          .use(passkeyLoginThrottle)

        router.get('password/forgot', [controllers.PasswordReset, 'create']).as('password.forgot')
        router
          .post('password/forgot', [controllers.PasswordReset, 'store'])
          .as('password.email')
          .use(passwordResetThrottle)
        // Lien signé à usage unique (cf. PasswordResetService) : `:id` = compte visé.
        router.get('password/reset/:id', [controllers.PasswordReset, 'edit']).as('password.reset')
        router
          .post('password/reset/:id', [controllers.PasswordReset, 'update'])
          .as('password.update')
      })
      .use(middleware.guest())

    router
      .group(() => {
        router.post('logout', [controllers.Session, 'destroy'])

        // Écran bloquant et renvoi : exemptés d'`emailVerified` par construction.
        router.get('email/verify', [controllers.EmailVerification, 'notice']).as('email.notice')
        router
          .post('email/verification/resend', [controllers.EmailVerification, 'resend'])
          .as('email.verification.resend')
          .use(emailVerificationResendThrottle)

        // Page « mon compte » : exemptée d'`emailVerified` (corriger une adresse
        // mal saisie, supprimer son compte).
        router.get('account', [controllers.Account, 'show']).as('account.show')
        router.patch('account', [controllers.Account, 'update']).as('account.update')
        router
          .patch('account/password', [controllers.Account, 'updatePassword'])
          .as('account.password.update')
        router.delete('account', [controllers.Account, 'destroy']).as('account.destroy')

        // Passkeys du compte. `options` répond en JSON (cérémonie WebAuthn côté
        // navigateur), le reste en redirections Inertia.
        router
          .get('account/passkeys/options', [controllers.Passkey, 'options'])
          .as('account.passkeys.options')
        router.post('account/passkeys', [controllers.Passkey, 'store']).as('account.passkeys.store')
        router
          .patch('account/passkeys/:id', [controllers.Passkey, 'update'])
          .as('account.passkeys.update')
        router
          .delete('account/passkeys/:id', [controllers.Passkey, 'destroy'])
          .as('account.passkeys.destroy')

        // Tout le reste exige une adresse vérifiée, avant même l'onboarding.
        router
          .group(() => {
            // Recherche par image (IA) : acheteurs connectés, pas d'organisation requise.
            router
              .post('products/image-search', [controllers.ProductImageSearch, 'store'])
              .as('products.image_search')
              .use(imageSearchThrottle)

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
                // Tableau de bord de l'organisation courante (destination post-connexion).
                router.get('dashboard', [controllers.Dashboard, 'show']).as('dashboard.show')

                // Paramètres généraux de l'organisation courante (nom, coordonnées, logo).
                router
                  .get('organization/settings', [controllers.organization.Settings, 'show'])
                  .as('organization.settings')
                // POST (et non PATCH) pour porter le corps multipart de l'upload du logo.
                router
                  .post('organization/settings', [controllers.organization.Settings, 'update'])
                  .as('organization.settings.update')

                // Cycle de vie : bascule d'organisation (sélecteur, affiché au-delà
                // d'une organisation) et création d'une organisation supplémentaire.
                router
                  .post('organization/switch/:id', [controllers.organization.Lifecycle, 'switch'])
                  .as('organization.switch')
                router
                  .get('organization/new', [controllers.organization.Lifecycle, 'create'])
                  .as('organization.create')
                router
                  .post('organization/new', [controllers.organization.Lifecycle, 'store'])
                  .as('organization.store')

                // Départ volontaire et archivage de l'organisation courante.
                router
                  .delete('organization/leave', [controllers.organization.Lifecycle, 'leave'])
                  .as('organization.leave')
                router
                  .post('organization/archive', [controllers.organization.Lifecycle, 'archive'])
                  .as('organization.archive')

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

                // Documents PDF (profil et fiches produit) — cf. `start/routes/documents.ts`.
                registerDocumentRoutes()

                // Demandes de devis, acheteur et fournisseur — cf. `start/routes/rfqs.ts`.
                registerRfqRoutes()
                registerQuoteRoutes()
                registerOrderRoutes()
                registerNotificationRoutes()
              })
              .use(middleware.onboarded())

            // Back-office plateforme : réservé à l'équipe (un `platform_role` autre que
            // `none`), sans lien avec une organisation — donc hors `onboarded`. Chaque
            // contrôleur autorise le droit précis de sa section.
            router
              .group(() => {
                router.get('admin', [controllers.admin.Dashboard, 'index']).as('admin.dashboard')

                router
                  .get('admin/organizations', [controllers.admin.Organization, 'index'])
                  .as('admin.organizations.index')
                router
                  .get('admin/organizations/:id', [controllers.admin.Organization, 'show'])
                  .as('admin.organizations.show')

                router.get('admin/users', [controllers.admin.User, 'index']).as('admin.users.index')
                router
                  .patch('admin/users/:id/platform-role', [
                    controllers.admin.PlatformRole,
                    'update',
                  ])
                  .as('admin.users.platform_role.update')

                // Journal d'audit des actions d'écriture du back-office.
                router
                  .get('admin/audit', [controllers.admin.AuditLog, 'index'])
                  .as('admin.audit.index')

                // Demande des clients : recherches, consultations, export CSV.
                router
                  .get('admin/demand', [controllers.admin.Demand, 'index'])
                  .as('admin.demand.index')
                router
                  .get('admin/demand/export', [controllers.admin.Demand, 'export'])
                  .as('admin.demand.export')

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

                // Administration des facettes du catalogue (attributs et valeurs, #48).
                router
                  .get('admin/attributes', [controllers.admin.Attribute, 'index'])
                  .as('admin.attributes.index')
                router
                  .get('admin/attributes/new', [controllers.admin.Attribute, 'create'])
                  .as('admin.attributes.create')
                router
                  .post('admin/attributes', [controllers.admin.Attribute, 'store'])
                  .as('admin.attributes.store')
                router
                  .get('admin/attributes/:id/edit', [controllers.admin.Attribute, 'edit'])
                  .as('admin.attributes.edit')
                router
                  .patch('admin/attributes/:id', [controllers.admin.Attribute, 'update'])
                  .as('admin.attributes.update')
                router
                  .delete('admin/attributes/:id', [controllers.admin.Attribute, 'destroy'])
                  .as('admin.attributes.destroy')
                router
                  .post('admin/attributes/:id/values', [controllers.admin.AttributeValue, 'store'])
                  .as('admin.attribute_values.store')
                router
                  .patch('admin/attributes/:id/values/:valueId', [
                    controllers.admin.AttributeValue,
                    'update',
                  ])
                  .as('admin.attribute_values.update')
                router
                  .delete('admin/attributes/:id/values/:valueId', [
                    controllers.admin.AttributeValue,
                    'destroy',
                  ])
                  .as('admin.attribute_values.destroy')
              })
              .use(middleware.platformAdmin())
          })
          .use(middleware.emailVerified())
      })
      .use(middleware.auth())
  })
  .prefix(':locale')
  .where('locale', LOCALE_ROUTE_PATTERN)
