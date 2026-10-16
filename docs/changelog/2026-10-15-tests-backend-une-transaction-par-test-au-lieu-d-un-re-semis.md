# Tests backend : une transaction par test, au lieu d'un re-semis (phase 2)

> Date : 2026-10-15

- **`useDatabase` (`tests/utils/setup.ts`)** : `truncate()` + seeders passent **une
  fois par groupe** ; chaque test s'exécute dans une transaction globale
  (`wrapInGlobalTransaction`) annulée à sa fin. Avant : vidage, `migration:run`,
  re-semis (dont `MainSeeder` pour 5 groupes) et `db:truncate` **à chaque test**.
  Mesuré en local sur la suite complète (210 tests) : ~43 s → ~26 s ; API des
  specs inchangée.
- Les séquences d'identifiants ne sont plus remises à zéro entre deux tests : ne
  jamais dépendre d'un `id` en dur. Un groupe `perTest: false` reste en lecture seule.
- `docs/tests.md` aligné sur le code.
