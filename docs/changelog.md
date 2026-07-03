# Changelog

## 2026-07-03 — Charte graphique : couleurs de marque et favicon

Mise en place de la charte graphique du site, alignée sur le logo (violet `#4032C8` / RGB `64, 50, 200`, fond dominant blanc, violet réservé à l'accent — boutons et rappels), inspirée de la sobriété de [stripe.com](https://stripe.com/en-fr).

- **`inertia/css/app.css`** :
  - Ajout des variables de marque `--primary-1` à `--primary-11` + `--color-primary-contrast` dans `:root`
  - Ajout d'un bloc `@theme` Tailwind v4 exposant `--color-primary`, `--color-primary-hover`, `--color-primary-1/3/6/9/10/11`, `--color-primary-contrast` (utilisables via `bg-primary`, `text-primary`, etc.)
  - `button` et `.hero .button` passent du gris/noir au violet de marque (fond `--color-primary`, hover `--color-primary-hover`)
  - Ajout d'un anneau de focus visible violet (`--primary-6`) sur boutons, liens, champs de formulaire
- **`public/favicon.svg`, `public/favicon.png`** : copiés depuis `inertia/assets/` pour être servis statiquement (provider `@adonisjs/static`, déjà actif)
- **`resources/views/inertia_layout.edge`** : ajout des balises `<link rel="icon">` (SVG + PNG), `<meta name="theme-color" content="#4032c8">`, et titre par défaut `promotionalsourcing.eu` (au lieu du placeholder `AdonisJS`)
- **`docs/charte-graphique.md`** : documentation complète de la charte (logo, couleurs avec hex/RGB, règles d'usage du violet, typographie, composants, favicon)
- **Comportement notable** : le violet reste un accent — pas de fond de page ni de navigation en violet, uniquement CTA/boutons/focus/rappels ; les couleurs sémantiques (succès/erreur) restent inchangées

## 2026-06-27 — Activation du SSR (Server-Side Rendering)

Activation du rendu côté serveur via Inertia.js + Vue 3 SSR pour améliorer le SEO et les performances de la marketplace.

- **`config/inertia.ts`** : `ssr.enabled` passé à `true`
- **`vite.config.ts`** : `ssr.enabled` passé à `true` dans le plugin Inertia
- **`inertia/app.ts`** : `createApp` remplacé par `createSSRApp` pour l'hydratation côté client
- **`inertia/ssr.ts`** : déjà configuré correctement (`createSSRApp` + `renderToString`)
- **Build SSR** : `node ace build` génère le bundle SSR ; en dev `node ace serve --hmr` supporte le SSR à chaud
- **À surveiller** : tout accès à `window` / `document` doit être dans `onMounted` ou un guard `typeof window !== 'undefined'`

## 2026-06-26 — Entités de base : Organisation, Rôles, Permissions

Création du socle multi-tenant : organisations (entreprises françaises), rôles système et permissions granulaires.

- **Tables créées** :
  - `organizations` — entreprise avec champs B2B FR (SIRET, TVA, secteur, taille, adresse)
  - `roles` — 4 rôles système : `owner`, `admin`, `manager`, `member`
  - `permissions` — 8 permissions granulaires : `organization:manage`, `members:invite`, `members:manage`, `roles:assign`, `sourcing:create`, `sourcing:manage`, `sourcing:view`, `billing:manage`
  - `role_permissions` — pivot rôle ↔ permission (clé primaire composite, sans timestamps)
  - `organization_users` — pivot enrichi user ↔ organisation avec `role_id` et `joined_at`
- **Colonne ajoutée** : `users.current_organization_id` (FK nullable → organizations, SET NULL on delete)
- **Modèles** :
  - `app/models/organization.ts` — hasMany OrganizationUser, manyToMany User
  - `app/models/role.ts` — manyToMany Permission, hasMany OrganizationUser
  - `app/models/permission.ts` — manyToMany Role
  - `app/models/organization_user.ts` — belongsTo Organization, User, Role (modèle dédié pour preload Bouncer)
  - `app/models/user.ts` — ajout des relations organizations, organizationUsers, currentOrganization
- **Seeders** (`database/seeders/`) :
  - `role_seeder.ts`, `permission_seeder.ts`, `role_permission_seeder.ts` — idempotents via `updateOrCreateMany` / `sync()`
- **Types partagés** (`shared/types/`) :
  - `role.ts` — `RoleSlug`, `RoleType`, `PermissionType`, `RoleWithPermissionsType`
  - `organization.ts` — `OrganizationSize`, `OrganizationType`, `OrganizationMemberType`, `CreateOrganizationData`
- **Abilities Bouncer** (`app/abilities/main.ts`) :
  - `canManageOrganization` — owner ou admin
  - `canInviteMembers` — owner, admin ou manager
  - `canManageMembers` — owner ou admin
- **Validators** (`app/validators/organization.ts`) : `createOrganizationValidator` (slug unique + regex kebab-case, SIRET 14 chiffres, CP 5 chiffres), `updateOrganizationValidator` (sans slug)
- **Transformers** : `organization_transformer.ts`, `role_transformer.ts`
- **Comportement notable** :
  - Un utilisateur peut appartenir à plusieurs organisations ; `current_organization_id` stocke le contexte actif
  - Le slug d'une organisation ne peut pas être modifié via `updateOrganizationValidator` (risque de casser les URLs)
  - RESTRICT sur `role_id` dans `organization_users` — suppression d'un rôle bloquée si des membres l'utilisent

## 2026-06-26 — Système de mail (@adonisjs/mail)

Installation et configuration de `@adonisjs/mail` avec le transport SMTP.

- **Package** : `@adonisjs/mail@10.3.0`
- **Fichiers ajoutés** :
  - `config/mail.ts` — configuration SMTP avec auth conditionnelle (désactivée si `SMTP_USERNAME` vide, pour Mailpit)
  - `app/mails/welcome_notification.ts` — mail de bienvenue post-inscription
  - `resources/views/emails/welcome.edge` — template Edge du mail de bienvenue
  - `docs/mail.md`
- **`adonisrc.ts`** : ajout du provider `@adonisjs/mail/mail_provider` et des commandes `@adonisjs/mail/commands`
- **`start/env.ts`** : ajout des variables `SMTP_*`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME`
- **Comportement notable** :
  - Auth SMTP désactivée automatiquement si `SMTP_USERNAME` est vide (compatible Mailpit en local)
  - `globals` Edge disponibles dans tous les templates : `brandName`, `appUrl`
  - Envoi en queue : `await mail.sendLater(new WelcomeNotification(user))`
- **En dev** : Mailpit (`brew install mailpit`) — interface sur http://localhost:8025
- **Doc** : [docs/mail.md](./mail.md)

## 2026-06-26 — Système d'événements (Emitter)

Configuration du système d'événements AdonisJS (`@adonisjs/core/services/emitter`) avec listeners lazy-loaded.

- **Fichiers ajoutés** :
  - `app/events/user_registered.ts` — event émis à l'inscription d'un utilisateur
  - `app/events/user_logged_in.ts` — event émis à la connexion d'un utilisateur
  - `app/listeners/on_user_registered.ts` — listener associé à `UserRegistered`
  - `app/listeners/on_user_logged_in.ts` — listener associé à `UserLoggedIn`
  - `start/events.ts` — enregistrement des bindings event → listener
- **`adonisrc.ts`** : ajout du preload `#start/events`
- **Comportement notable** :
  - Les listeners sont lazy-loaded (import dynamique) — aucun impact sur le démarrage
  - Pour émettre : `await emitter.emit(UserRegistered, new UserRegistered(user))`
  - Pour ajouter un event : classe dans `app/events/`, listener dans `app/listeners/`, binding dans `start/events.ts`
- **Doc** : [docs/emitter.md](./emitter.md)

## 2026-06-26 — Configuration des tests (Vitest + Japa)

Mise en place complète de l'environnement de tests backend (Japa) et frontend (Vitest).

- **Packages ajoutés** : `@japa/api-client`, `vitest`, `@vue/test-utils`, `happy-dom`
- **Fichiers ajoutés** :
  - `vitest.config.ts` — config Vitest séparée (plugin Vue, env `happy-dom`, aliases `~/` et `@generated`)
  - `tests/bootstrap.ts` — ajout du plugin `apiClient()` dans le tableau `plugins` Japa
  - `tests/unit/example.spec.ts` — exemple de test unitaire Japa
  - `tests/functional/example.spec.ts` — exemple de test fonctionnel HTTP Japa (client HTTP)
  - `tests/inertia/example.spec.ts` — exemple de test composant Vue avec `@vue/test-utils`
- **Comportement notable** :
  - Japa utilise SQLite en mode test (via `NODE_ENV=test` dans `config/database.ts`)
  - Les tests fonctionnels démarrent un serveur HTTP AdonisJS via `testUtils.httpServer().start()`
  - `SESSION_DRIVER=memory` dans `.env.test`
- **Commandes** :
  - Backend : `node ace test` (toutes suites) ou `node ace test --suites=unit|functional`
  - Frontend : `pnpm run test:inertia`
- **Doc** : [docs/tests.md](./tests.md)

## 2026-06-26 — Gestion des droits et permissions (Bouncer)

Installation et configuration de `@adonisjs/bouncer` pour l'autorisation.

- **Routes** : aucune route exposée — les vérifications se font dans les controllers via `ctx.bouncer`
- **Fichiers ajoutés** :
  - `app/abilities/main.ts` — abilities globales (`isAuthenticated`, `editOwnProfile`)
  - `app/policies/user_policy.ts` — policy `UserPolicy` (`view`, `update`, `delete`)
  - `app/middleware/initialize_bouncer_middleware.ts` — middleware branché sur `router` dans `start/kernel.ts`
- **Config** : `adonisrc.ts` mis à jour avec `bouncer_provider`, commandes et hook `indexPolicies()`
- **Usage controller** : `await bouncer.allows('isAuthenticated')` / `await bouncer.with(UserPolicy).authorize('update', user)`

## 2026-06-26 — Système de queue (background jobs)

Installation et configuration de `@adonisjs/queue` avec le driver PostgreSQL (via Lucid).

- **Routes** : aucune route HTTP exposée — les jobs sont dispatchés programmatiquement depuis les services/controllers
- **Tables créées** : `queue_jobs`, `queue_schedules` (migration `1782491779941_create_queue_tables`)
- **Fichiers ajoutés** : `config/queue.ts`, `start/scheduler.ts`, `app/jobs/` (dossier)
- **Config** : driver `database` sur la connexion `pg`, concurrence 5, délai idle 2s
- **Worker** : démarrer avec `node ace queue:work`
- **Comportement notable** : en environnement `test`, la connexion bascule sur SQLite ; en dev/prod, PostgreSQL est utilisé
- **Doc** : [docs/queue.md](./queue.md)
