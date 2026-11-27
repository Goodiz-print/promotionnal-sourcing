# CI : plus de relance sur main, jobs regroupés

> Date : 2026-11-27

L'organisation GitHub est sur le plan Free (2 000 minutes Actions par mois). Le quota a été épuisé dès le 10/11, et la CI est restée bloquée à partir du 19/11. Cette modification réduit la consommation sans retirer de vérification.

**Plus de CI sur `main`** (`.github/workflows/ci.yml`, `.github/workflows/docker.yml`)

- La CI ne se déclenche plus sur `push: main`, seulement sur les pull requests et en `workflow_call`.
- `docker.yml` se déclenche directement sur le push sur `main`, au lieu d'attendre la fin de la CI (`workflow_run`). Son premier job, `verify`, lance `scripts/ci/commit_tested.sh` et répond `tested=true` si trois conditions sont réunies :
  - le commit provient d'une PR mergée ;
  - la CI de cette PR est verte sur sa tête ;
  - l'arbre git du commit est identique à celui de cette tête, ce qui est le cas pour un squash ou un rebase d'une PR à jour.
- Sinon (PR pas à jour, push direct, API indisponible), le job `ci` rappelle la CI complète. `build-push` ne part que si `verify` réussit et que `ci` est vert ou sauté.
- L'image et `APP_VERSION` utilisent désormais `github.sha`.
- Conseil : mettre la PR à jour avec `main` avant de merger, pour éviter de repayer une CI complète.

**Jobs regroupés** (chaque job est arrondi à la minute supérieure et réinstalle les dépendances)

- `checks` réunit `lint`, `lint-ci`, `build` (avec le typecheck) et `test-frontend`. shellcheck couvre aussi `scripts/ci/*.sh`.
- `test-backend` passe de 4 à 2 shards fonctionnels, plus le shard unitaire.
- `test-search` réunit les deux jobs Meilisearch : une passe sans embedder, puis une passe avec `huggingface`.
- `docker-build` ne tourne que sur les PR : rappelée depuis `docker.yml`, la CI le sautait de toute façon, car `build-push` construit l'image juste après.

Estimation : environ 16 minutes facturées par run de PR au lieu d'environ 20, et aucun run après le merge quand la PR était à jour.

Documentation : `docs/deploiement.md` (nouvelle section « Pas de CI rejouée sur main ») et `docs/search.md`.
