# Configuration des tests (Vitest + Japa)

> Date : 2026-06-26

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
