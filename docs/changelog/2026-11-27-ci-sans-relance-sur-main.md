# CI : plus de relance sur main, jobs regroupés

> Date : 2026-11-27

L'organisation GitHub est sur le plan Free (2 000 minutes Actions par mois). Le quota a été épuisé dès le 10/11, et la CI est restée bloquée à partir du 19/11. Cette modification réduit la consommation sans retirer de vérification.

**Plus de CI sur `main`** (`.github/workflows/ci.yml`, `.github/workflows/docker.yml`)

- La CI ne se déclenche plus sur `push: main`, seulement sur les pull requests et en `workflow_call`.
- `docker.yml` se déclenche directement sur le push sur `main`, au lieu d'attendre la fin de la CI (`workflow_run`). Son premier job, `verify`, lance `scripts/ci/commit_tested.sh` et répond `tested=true` si trois conditions sont réunies :
  - le commit provient d'une PR mergée ;
  - le dernier run de CI sur la tête de cette PR est vert, avec au moins un job réellement exécuté ;
  - l'arbre git du commit est identique à celui de cette tête, ce qui est le cas pour un squash ou un rebase d'une PR à jour.
- Sinon (PR pas à jour, push direct, API indisponible), le job `ci` rappelle la CI complète. `build-push` ne part que si `verify` réussit et que `ci` est vert ou sauté.
- L'image et `APP_VERSION` utilisent désormais `github.sha`.
- Conseil : mettre la PR à jour avec `main` avant de merger, pour éviter de repayer une CI complète.

**Jobs regroupés** (chaque job est arrondi à la minute supérieure et réinstalle les dépendances)

- `checks` réunit `lint`, `lint-ci`, `build` (avec le typecheck) et `test-frontend`. shellcheck couvre aussi `scripts/ci/*.sh`.
- `test-backend` devient un seul job : `unit`, puis `functional` (lancé même si `unit` échoue), au lieu de 5 jobs.
- `test-search` réunit les deux jobs Meilisearch : une passe sans embedder, puis une passe avec `huggingface`.

**Pas de CI sur les PR en brouillon** (`ci.yml`)

- Chaque job est sauté tant que la PR est en brouillon, et un job sauté n'est pas facturé. La CI part au passage en « Ready for review » (`ready_for_review`), puis à chaque push.
- Un run de brouillon se termine en `success` alors que tous ses jobs sont sautés. `commit_tested.sh` lit donc le run **le plus récent** sur la tête de la PR et exige au moins un job vert.
- Conseil : ouvrir les PR en brouillon pendant le développement.

**Build Docker de PR seulement si l'image peut changer** (`.github/workflows/docker-pr.yml`)

- `docker-build` quitte `ci.yml` pour son propre workflow, filtré par chemins : `Dockerfile`, `.dockerignore`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `patches/**`. Quand rien ne correspond, aucun run n'est créé.
- Les contrôles de l'image (pas de root, pas de source `.ts` ni de `.env`, Ghostscript présent) passent dans `scripts/ci/check_image.sh`. `build-push` (`docker.yml`) les exécute sur `main` avant de pousser l'image : une image mauvaise n'est ni poussée ni déployée.

Estimation : environ 13 minutes facturées par run de PR au lieu d'environ 20 (plus 3 minutes quand la PR touche l'image), aucun run sur les brouillons, et aucun run après le merge quand la PR était à jour.

Documentation : `docs/deploiement.md` (nouvelle section « Pas de CI rejouée sur main ») et `docs/search.md`.
