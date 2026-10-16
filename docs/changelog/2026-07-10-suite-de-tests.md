# Suite de tests (catalogue + i18n)

> Date : 2026-07-10

Couverture automatisée de l'existant avant le moteur de recherche. Les tests catalogue s'appuient sur PostgreSQL (pgvector/tsvector) et sont gardés par dialecte.

- **Garde de dialecte** (`tests/utils/database.ts`) : `isPostgres()` ; les groupes catalogue s'exécutent sous Postgres (CI + `DB_CONNECTION=pg`) et sont **sautés** sur SQLite (aucune migration lancée → pas de casse locale).
- **`tests/functional/catalogue.spec.ts`** : sanity du seed (6 produits, 12 traductions), **transformers localisés** (`new ProductTransformer(p, 'en').toObject().name` → anglais ; `AttributeValueTransformer` → `Blue`/`Bleu`), et **filtrage `ET`** via les relations réelles (`whereHas('category')` + `whereHas('attributeValues')` → uniquement les 2 crayons bleus).
- **`tests/functional/catalogue_fts.spec.ts`** : **FTS par langue** (`to_tsquery('english','watercolor')` → ligne EN ; `to_tsquery('french','aquarelle')` → ligne FR ; contrôle croisé), et `products.embedding` présent/NULL.
- **`tests/functional/i18n.spec.ts`** enrichi : rendu localisé `/fr/login` (« Se connecter ») et `/en/login` (« Password »), persistance de la locale dans le cookie en visitant `/en`.
- **Semis en test** via `MainSeeder` directement (ordre des dépendances) plutôt que `db:seed` (qui exécute aussi chaque seeder isolément → `dev_user` avant les rôles → échec sur base vierge). Cleanup par `testUtils.db().truncate()`.
- **Doc** : `docs/tests.md` mis à jour (plugins réels, base Postgres pour le catalogue, pattern de garde de dialecte).
- **Résultat** : SQLite → 16 passés + 8 sautés (catalogue) ; PostgreSQL → 24 passés ; Vitest → 6.
