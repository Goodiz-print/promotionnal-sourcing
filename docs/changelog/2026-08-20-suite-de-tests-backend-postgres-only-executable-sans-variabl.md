# Suite de tests backend Postgres-only, exécutable sans variables

> Date : 2026-08-20

`pnpm test` seul ne passait plus : sans `DB_CONNECTION=pg`, `config/database.ts`
retombait sur SQLite, où la migration
`…967_alter_organization_invitations_add_expired_status`
(`ALTER TABLE … DROP CONSTRAINT IF EXISTS`, syntaxe Postgres) faisait échouer
**tous** les hooks de setup. Le mode SQLite était donc mort sans que rien ne le
dise, et lancer la suite imposait de passer six variables `DB_*` à la main — une
faute de frappe suffisant à faire tronquer la base de **développement**.

- **PostgreSQL devient le seul moteur supporté.** `config/database.ts` n'expose
  plus qu'une connexion `pg` (plus de ternaire sur `NODE_ENV`), la variable
  `DB_CONNECTION` disparaît (`start/env.ts`, `.env.example`, CI) et
  `better-sqlite3` sort des dépendances. Le repli SQLite testait de toute façon
  un moteur différent de la production, sur un schéma qui dépend de pgvector,
  `tsvector`, des colonnes générées, de `text[]` et de contraintes `CHECK` en
  SQL brut.
- **`.env.test` porte la configuration de la base de test** (`127.0.0.1:5433`,
  base `test`) : `pnpm test:db && pnpm test` suffit, sans aucune variable.
  L'ordre de chargement AdonisJS (`.env.test.local` → `.env.test` → `.env`)
  fait primer ces valeurs sur `.env`, tandis qu'une vraie variable
  d'environnement prime sur le fichier — la CI garde donc la main sur son hôte
  et son port.
- **`postgres_test` écoute sur 5433** au lieu de 5432, port trop souvent occupé
  par un autre projet : le service du `docker-compose.yml` était inutilisable
  sans bricolage, et `docs/tests.md` documentait le contournement.
  Nouveau script `pnpm test:db`.
- **Garde-fou anti-écrasement** (`tests/bootstrap.ts`) : la suite refuse de
  démarrer si `DB_DATABASE` ne se termine pas par `test`, avec un message
  explicite. `process.exit(1)` plutôt qu'un `throw` — une exception dans un hook
  global laisse le runner Japa avec ses handles ouverts (`forceExit: false`) et
  le process ne rend jamais la main.
- **Fin des gardes de dialecte** : `isPostgres()` et `tests/utils/database.ts`
  sont supprimés, ainsi que les `group.tap(t => t.skip(…))` des **12 specs**
  concernées. En local, ces specs se sautaient en silence — la suite affichait
  « passé » en n'exécutant que la moitié du périmètre.
- **Vérifié** : `pnpm test` sans aucune variable → **171 tests, 0 sauté** (31 s
  sur la base tmpfs) ; `DB_DATABASE=…_dev pnpm test` refuse de démarrer.
- **Doc** : `docs/tests.md` (sections base de données, garde-fou, initialisation
  par groupe) ; mentions SQLite corrigées dans `CLAUDE.md`, `docs/catalogue.md`
  et `docs/organisations.md`.
