# Changelog

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
