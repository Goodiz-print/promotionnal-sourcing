# Changelog

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
