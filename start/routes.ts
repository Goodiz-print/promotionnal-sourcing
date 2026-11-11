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
import { registerQuoteCartRoutes } from '#start/routes/quote_cart'
import { registerOrderRoutes } from '#start/routes/orders'
import { registerMessagingRoutes } from '#start/routes/messaging'
import { registerNotificationRoutes } from '#start/routes/notifications'
import { registerDocumentRoutes } from '#start/routes/documents'
import { registerHealthRoutes } from '#start/routes/health'
import {
  registerAdClickRoutes,
  registerAdminAdRoutes,
  registerAdWebhookRoutes,
  registerSupplierAdRoutes,
} from '#start/routes/ads'
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
registerAdWebhookRoutes()

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

    // Lien de clic d'un produit sponsorisé (URL signée, sans auth).
    registerAdClickRoutes()

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
                registerQuoteCartRoutes()
                registerOrderRoutes()
                registerNotificationRoutes()
                registerMessagingRoutes()
                // Produits sponsorisés côté fournisseur — cf. `start/routes/ads.ts`.
                registerSupplierAdRoutes()
              })
              .use(middleware.onboarded())

            // Back-office plateforme : réservé à l'équipe (un `platform_role` autre que
            // `none`), sans lien avec une organisation — donc hors `onboarded`. Chaque
            // contrôleur autorise le droit précis de sa section.
            router
              .group(() => {
                router.get('admin', [controllers.admin.Dashboard, 'index']).as('admin.dashboard')

                // Supervision des produits sponsorisés — cf. `start/routes/ads.ts`.
                registerAdminAdRoutes()

                router
                  .get('admin/organizations', [controllers.admin.Organization, 'index'])
                  .as('admin.organizations.index')
                router
                  .get('admin/organizations/:id', [controllers.admin.Organization, 'show'])
                  .where('id', router.matchers.number())
                  .as('admin.organizations.show')
                // Actions sur les organisations (#161) : archivage, modification, membres, invitations.
                router
                  .post('admin/organizations/:id/archive', [
                    controllers.admin.OrganizationManagement,
                    'archive',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.organizations.archive')
                router
                  .post('admin/organizations/:id/restore', [
                    controllers.admin.OrganizationManagement,
                    'restore',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.organizations.restore')
                router
                  .patch('admin/organizations/:id', [
                    controllers.admin.OrganizationManagement,
                    'update',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.organizations.update')
                router
                  .patch('admin/organizations/:id/type', [
                    controllers.admin.OrganizationManagement,
                    'changeType',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.organizations.change_type')
                router
                  .patch('admin/organizations/:id/members/:membershipId/role', [
                    controllers.admin.OrganizationManagement,
                    'changeMemberRole',
                  ])
                  .where('id', router.matchers.number())
                  .where('membershipId', router.matchers.number())
                  .as('admin.organizations.member_role')
                router
                  .delete('admin/organizations/:id/members/:membershipId', [
                    controllers.admin.OrganizationManagement,
                    'removeMember',
                  ])
                  .where('id', router.matchers.number())
                  .where('membershipId', router.matchers.number())
                  .as('admin.organizations.remove_member')
                router
                  .delete('admin/organizations/:id/invitations/:invitationId', [
                    controllers.admin.OrganizationManagement,
                    'revokeInvitation',
                  ])
                  .where('id', router.matchers.number())
                  .where('invitationId', router.matchers.number())
                  .as('admin.organizations.revoke_invitation')
                router
                  .post('admin/organizations/:id/invitations/:invitationId/resend', [
                    controllers.admin.OrganizationManagement,
                    'resendInvitation',
                  ])
                  .where('id', router.matchers.number())
                  .where('invitationId', router.matchers.number())
                  .as('admin.organizations.resend_invitation')

                router.get('admin/users', [controllers.admin.User, 'index']).as('admin.users.index')
                router
                  .get('admin/users/:id', [controllers.admin.User, 'show'])
                  .where('id', router.matchers.number())
                  .as('admin.users.show')
                router
                  .patch('admin/users/:id/platform-role', [
                    controllers.admin.PlatformRole,
                    'update',
                  ])
                  .as('admin.users.platform_role.update')
                // Actions sur les comptes (#160) : suspension, suppression, support.
                router
                  .post('admin/users/:id/suspend', [controllers.admin.UserAccount, 'suspend'])
                  .where('id', router.matchers.number())
                  .as('admin.users.suspend')
                router
                  .post('admin/users/:id/reactivate', [controllers.admin.UserAccount, 'reactivate'])
                  .where('id', router.matchers.number())
                  .as('admin.users.reactivate')
                router
                  .post('admin/users/:id/resend-verification', [
                    controllers.admin.UserAccount,
                    'resendVerification',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.users.resend_verification')
                router
                  .post('admin/users/:id/password-reset', [
                    controllers.admin.UserAccount,
                    'passwordReset',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.users.password_reset')
                router
                  .delete('admin/users/:id', [controllers.admin.UserAccount, 'destroy'])
                  .where('id', router.matchers.number())
                  .as('admin.users.destroy')

                // Journal d'audit des actions d'écriture du back-office.
                router
                  .get('admin/audit', [controllers.admin.AuditLog, 'index'])
                  .as('admin.audit.index')

                // Consentements légaux (#168) : consultation et export de preuve par organisation.
                router
                  .get('admin/consents', [controllers.admin.Consent, 'index'])
                  .as('admin.consents.index')
                router
                  .get('admin/consents/export', [controllers.admin.Consent, 'export'])
                  .as('admin.consents.export')

                // Annonces plateforme (#169) : historique, création et mise en queue de l'envoi.
                router
                  .get('admin/announcements', [controllers.admin.Announcement, 'index'])
                  .as('admin.announcements.index')
                router
                  .get('admin/announcements/new', [controllers.admin.Announcement, 'create'])
                  .as('admin.announcements.create')
                router
                  .post('admin/announcements', [controllers.admin.Announcement, 'store'])
                  .as('admin.announcements.store')
                router
                  .post('admin/announcements/:id/retry', [controllers.admin.Announcement, 'retry'])
                  .as('admin.announcements.retry')

                // Suivi des imports en masse (#170) : liste, fiche, relance et export des erreurs.
                router
                  .get('admin/imports', [controllers.admin.Import, 'index'])
                  .as('admin.imports.index')
                router
                  .get('admin/imports/:id', [controllers.admin.Import, 'show'])
                  .where('id', router.matchers.number())
                  .as('admin.imports.show')
                router
                  .post('admin/imports/:id/retry', [controllers.admin.Import, 'retry'])
                  .where('id', router.matchers.number())
                  .as('admin.imports.retry')
                router
                  .get('admin/imports/:id/errors', [controllers.admin.Import, 'errors'])
                  .where('id', router.matchers.number())
                  .as('admin.imports.errors')

                // IA et traductions (#177) : tableau de bord, rattrapage et relecture.
                router.get('admin/ai', [controllers.admin.Ai, 'index']).as('admin.ai.index')
                router
                  .post('admin/ai/backfill', [controllers.admin.Ai, 'backfill'])
                  .as('admin.ai.backfill')
                router
                  .get('admin/ai/translations', [controllers.admin.Ai, 'translations'])
                  .as('admin.ai.translations')
                router
                  .patch('admin/ai/translations/:entity/:id/:translationLocale', [
                    controllers.admin.Ai,
                    'correct',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.ai.translations.correct')

                // Supervision de la queue (#175) : santé, jobs, relance / annulation, planning.
                router
                  .get('admin/queue', [controllers.admin.Queue, 'index'])
                  .as('admin.queue.index')
                router
                  .get('admin/queue/jobs/:queue/:id', [controllers.admin.Queue, 'show'])
                  .as('admin.queue.show')
                router
                  .post('admin/queue/jobs/:queue/:id/retry', [controllers.admin.Queue, 'retry'])
                  .as('admin.queue.retry')
                router
                  .post('admin/queue/jobs/:queue/:id/cancel', [controllers.admin.Queue, 'cancel'])
                  .as('admin.queue.cancel')
                router
                  .post('admin/queue/schedules/:id/run', [controllers.admin.Queue, 'runSchedule'])
                  .as('admin.queue.schedules.run')

                // État de la recherche (#176) : santé Meilisearch, écart, réindexation, évaluation.
                router
                  .get('admin/search', [controllers.admin.Search, 'index'])
                  .as('admin.search.index')
                router
                  .post('admin/search/reindex', [controllers.admin.Search, 'reindex'])
                  .as('admin.search.reindex')
                router
                  .post('admin/search/evaluate', [controllers.admin.Search, 'evaluate'])
                  .as('admin.search.evaluate')

                // Supervision des emails en échec et du stockage Cellar (#178).
                router.get('admin/mail', [controllers.admin.Mail, 'index']).as('admin.mail.index')
                router
                  .post('admin/mail/retry', [controllers.admin.Mail, 'retryAll'])
                  .as('admin.mail.retryAll')
                router
                  .get('admin/mail/:id', [controllers.admin.Mail, 'show'])
                  .where('id', router.matchers.number())
                  .as('admin.mail.show')
                router
                  .post('admin/mail/:id/retry', [controllers.admin.Mail, 'retry'])
                  .where('id', router.matchers.number())
                  .as('admin.mail.retry')
                router
                  .get('admin/storage', [controllers.admin.Storage, 'index'])
                  .as('admin.storage.index')
                router
                  .post('admin/storage/recover', [controllers.admin.Storage, 'recover'])
                  .as('admin.storage.recover')

                // Santé de la plateforme (#179).
                router
                  .get('admin/health', [controllers.admin.Health, 'index'])
                  .as('admin.health.index')

                // Administration du catalogue produits (#164) : liste, fiche et actions.
                router
                  .get('admin/products', [controllers.admin.Product, 'index'])
                  .as('admin.products.index')
                router
                  .get('admin/products/:id', [controllers.admin.Product, 'show'])
                  .where('id', router.matchers.number())
                  .as('admin.products.show')
                router
                  .post('admin/products/:id/hide', [controllers.admin.ProductManagement, 'hide'])
                  .where('id', router.matchers.number())
                  .as('admin.products.hide')
                router
                  .post('admin/products/:id/unhide', [
                    controllers.admin.ProductManagement,
                    'unhide',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.products.unhide')
                router
                  .post('admin/products/:id/unpublish', [
                    controllers.admin.ProductManagement,
                    'unpublish',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.products.unpublish')
                router
                  .post('admin/products/:id/publish', [
                    controllers.admin.ProductManagement,
                    'publish',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.products.publish')
                router
                  .post('admin/products/:id/archive', [
                    controllers.admin.ProductManagement,
                    'archive',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.products.archive')
                router
                  .post('admin/products/:id/restore', [
                    controllers.admin.ProductManagement,
                    'restore',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.products.restore')
                router
                  .post('admin/products/:id/reindex', [
                    controllers.admin.ProductManagement,
                    'reindex',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.products.reindex')

                // Modération : file des organisations fournisseurs et produits, décisions.
                router
                  .get('admin/moderation', [controllers.admin.Moderation, 'index'])
                  .as('admin.moderation.index')
                router
                  .get('admin/moderation/:type/:id', [controllers.admin.Moderation, 'show'])
                  .as('admin.moderation.show')
                router
                  .post('admin/moderation/:type/:id/decision', [
                    controllers.admin.Moderation,
                    'decide',
                  ])
                  .as('admin.moderation.decide')

                // Revue des inscriptions agence : file, fiche, décision.
                router
                  .get('admin/agency-reviews', [controllers.admin.AgencyReview, 'index'])
                  .as('admin.agency_reviews.index')
                router
                  .get('admin/agency-reviews/:id', [controllers.admin.AgencyReview, 'show'])
                  .where('id', router.matchers.number())
                  .as('admin.agency_reviews.show')
                router
                  .post('admin/agency-reviews/:id/decision', [
                    controllers.admin.AgencyReview,
                    'decide',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.agency_reviews.decide')

                // Supervision des demandes de devis, devis et commandes (#166) : lecture
                // pour `trade.view`, interventions sur les demandes pour `trade.manage`.
                router.get('admin/rfqs', [controllers.admin.Rfq, 'index']).as('admin.rfqs.index')
                router
                  .get('admin/rfqs/:id', [controllers.admin.Rfq, 'show'])
                  .where('id', router.matchers.number())
                  .as('admin.rfqs.show')
                router
                  .post('admin/rfqs/:id/close', [controllers.admin.Rfq, 'close'])
                  .where('id', router.matchers.number())
                  .as('admin.rfqs.close')
                router
                  .post('admin/rfqs/:id/expire', [controllers.admin.Rfq, 'expire'])
                  .where('id', router.matchers.number())
                  .as('admin.rfqs.expire')
                router
                  .post('admin/rfqs/:id/remind', [controllers.admin.Rfq, 'remind'])
                  .where('id', router.matchers.number())
                  .as('admin.rfqs.remind')
                router
                  .get('admin/quotes', [controllers.admin.Quote, 'index'])
                  .as('admin.quotes.index')
                router
                  .get('admin/quotes/:id', [controllers.admin.Quote, 'show'])
                  .where('id', router.matchers.number())
                  .as('admin.quotes.show')
                router
                  .get('admin/orders', [controllers.admin.Order, 'index'])
                  .as('admin.orders.index')
                router
                  .get('admin/orders/:id', [controllers.admin.Order, 'show'])
                  .where('id', router.matchers.number())
                  .as('admin.orders.show')

                // Modération de la messagerie : fils, signalements, décisions.
                router
                  .get('admin/messaging', [controllers.admin.Messaging, 'index'])
                  .as('admin.messaging.index')
                router
                  .get('admin/messaging/reports', [controllers.admin.Messaging, 'reports'])
                  .as('admin.messaging.reports')
                router
                  .get('admin/messaging/conversations/:id', [controllers.admin.Messaging, 'show'])
                  .where('id', router.matchers.number())
                  .as('admin.messaging.show')
                router
                  .post('admin/messaging/conversations/:id/block', [
                    controllers.admin.Messaging,
                    'block',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.messaging.block')
                router
                  .post('admin/messaging/conversations/:id/unblock', [
                    controllers.admin.Messaging,
                    'unblock',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.messaging.unblock')
                router
                  .post('admin/messaging/messages/:id/hide', [controllers.admin.Messaging, 'hide'])
                  .where('id', router.matchers.number())
                  .as('admin.messaging.hide')
                router
                  .post('admin/messaging/messages/:id/unhide', [
                    controllers.admin.Messaging,
                    'unhide',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.messaging.unhide')
                router
                  .post('admin/messaging/messages/:id/warn', [controllers.admin.Messaging, 'warn'])
                  .where('id', router.matchers.number())
                  .as('admin.messaging.warn')
                router
                  .post('admin/messaging/reports/:id/dismiss', [
                    controllers.admin.Messaging,
                    'dismiss',
                  ])
                  .where('id', router.matchers.number())
                  .as('admin.messaging.dismiss')

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
                  .post('admin/categories/translate', [controllers.admin.Category, 'translate'])
                  .as('admin.categories.translate')
                router
                  .patch('admin/categories/:id/move', [controllers.admin.Category, 'move'])
                  .as('admin.categories.move')
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

                // Administration des certifications (labels de conformité, #165).
                router
                  .get('admin/certifications', [controllers.admin.Certification, 'index'])
                  .as('admin.certifications.index')
                router
                  .get('admin/certifications/new', [controllers.admin.Certification, 'create'])
                  .as('admin.certifications.create')
                router
                  .post('admin/certifications', [controllers.admin.Certification, 'store'])
                  .as('admin.certifications.store')
                router
                  .get('admin/certifications/:id/edit', [controllers.admin.Certification, 'edit'])
                  .as('admin.certifications.edit')
                router
                  .patch('admin/certifications/:id', [controllers.admin.Certification, 'update'])
                  .as('admin.certifications.update')
                router
                  .delete('admin/certifications/:id', [controllers.admin.Certification, 'destroy'])
                  .as('admin.certifications.destroy')

                // Administration des techniques de marquage (#165).
                router
                  .get('admin/marking-techniques', [controllers.admin.MarkingTechnique, 'index'])
                  .as('admin.marking_techniques.index')
                router
                  .get('admin/marking-techniques/new', [
                    controllers.admin.MarkingTechnique,
                    'create',
                  ])
                  .as('admin.marking_techniques.create')
                router
                  .post('admin/marking-techniques', [controllers.admin.MarkingTechnique, 'store'])
                  .as('admin.marking_techniques.store')
                router
                  .get('admin/marking-techniques/:id/edit', [
                    controllers.admin.MarkingTechnique,
                    'edit',
                  ])
                  .as('admin.marking_techniques.edit')
                router
                  .patch('admin/marking-techniques/:id', [
                    controllers.admin.MarkingTechnique,
                    'update',
                  ])
                  .as('admin.marking_techniques.update')
                router
                  .delete('admin/marking-techniques/:id', [
                    controllers.admin.MarkingTechnique,
                    'destroy',
                  ])
                  .as('admin.marking_techniques.destroy')

                // Gestion des attributs associés aux catégories (#165).
                router
                  .post('admin/categories/:categoryId/attributes', [
                    controllers.admin.CategoryAttribute,
                    'store',
                  ])
                  .as('admin.categories.attributes.store')
                router
                  .patch('admin/categories/:categoryId/attributes/:id', [
                    controllers.admin.CategoryAttribute,
                    'update',
                  ])
                  .as('admin.categories.attributes.update')
                router
                  .delete('admin/categories/:categoryId/attributes/:id', [
                    controllers.admin.CategoryAttribute,
                    'destroy',
                  ])
                  .as('admin.categories.attributes.destroy')
                router
                  .patch('admin/categories/:categoryId/attributes/:id/ranges', [
                    controllers.admin.CategoryAttribute,
                    'updateRanges',
                  ])
                  .as('admin.categories.attributes.ranges.update')
              })
              .use(middleware.platformAdmin())
          })
          .use(middleware.emailVerified())
      })
      .use(middleware.auth())
  })
  .prefix(':locale')
  .where('locale', LOCALE_ROUTE_PATTERN)
