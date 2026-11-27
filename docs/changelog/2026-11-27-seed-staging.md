# Données de test du staging

> Date : 2026-11-27

Le staging sert aux tests utilisateurs. Un workflow GitHub manuel, **Seed staging** (`.github/workflows/seed-staging.yml`), peuple sa base : seeders de démo, catalogues réels des fournisseurs, comptes de test, réindexation. Détail : [`docs/deploiement.md`](../deploiement.md#données-du-staging).

## Variables d'environnement

| Variable             | Statut                                                        | Rôle                                                                                                                     |
| -------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SEED_DEMO_PASSWORD` | obligatoire pour seeder en production (12 caractères minimum) | Mot de passe commun des comptes de démo et de test. En local, `password` par défaut                                      |
| `SEED_ADMIN_EMAILS`  | optionnelle                                                   | Admins nominatifs du staging, séparés par des virgules. Sans elle, `StagingAccountSeeder` ne fait rien. Jamais committée |

## Comportements notables

- **`DevUserSeeder` refuse de tourner en production sans `SEED_DEMO_PASSWORD`** (`DemoPasswordMissingException`). Le staging tourne avec `NODE_ENV=production` : avant ce changement, un seed y aurait créé un admin avec le mot de passe `password` sur une URL publique. La règle est dans `resolveDemoPassword` (`shared/helpers/seed.ts`).
- **Nouveau `StagingAccountSeeder`**, hors de `MainSeeder` :
  - les admins nominatifs de `SEED_ADMIN_EMAILS`, sans organisation ;
  - un compte fournisseur fictif par catalogue importé (`fournisseur-pf-concept@`, `fournisseur-passot-innovation@`, `fournisseur-inspirion@`, `fournisseur-makito@promotionnal-sourcing.test`) ;
  - 5 agences fictives (`agence-1@` à `agence-5@promotionnal-sourcing.test`).
    Chaque compte est `owner` de sa propre organisation. Le seeder est relançable.
- **Les fiches importées sont rattachées aux fournisseurs fictifs**, donc publiées : sans organisation, une fiche n'apparaît nulle part (#240). Le rattachement est direct, sans `AdminSupplierLinkService.link` :
  - aucune traduction IA du catalogue, qui reste dans la langue du flux (`fr`) ;
  - aucune entrée au journal d'audit.
    Une fiche déjà rattachée n'est pas touchée.
- **Scripts** : `scripts/deploy/clever_exec.sh` lance des commandes dans une image avec les variables d'une app Clever. C'est la partie commune extraite de `clever_migrate.sh`, dont le comportement ne change pas. `scripts/deploy/clever_seed.sh` enchaîne les étapes du seed. Il refuse une application dont l'`APP_URL` ne contient pas `staging`, et un import en échec n'empêche pas les étapes suivantes.
- **Tests** : `tests/unit/seed_helpers.spec.ts` (mot de passe, listes de comptes) et `tests/functional/staging_account_seeder.spec.ts` (comptes, organisations, rattachement, idempotence).
