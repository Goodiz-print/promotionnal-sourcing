# Meilisearch dans le docker-compose de dev (#112)

> Date : 2026-10-23

Le `docker-compose.yml` embarque désormais Meilisearch pour le développement local.

- Service **`meilisearch`** (sans profil, démarre avec `docker compose up -d`) : image `getmeili/meilisearch:v1.55.0` (version épinglée), port `7700`, volume `promotionnal-sourcing_meili_data` sur `/meili_data`, `MEILI_ENV=development`, healthcheck `GET /health`.
- Clé master lue depuis `MEILI_MASTER_KEY` (`.env`), jamais en dur dans le compose.
- `pnpm dev:all` (`scripts/dev.sh`) démarre aussi `meilisearch` et attend qu'il soit sain.
- `migrate`, `web` et `worker` attendent `meilisearch` (`service_healthy`) et reçoivent `MEILISEARCH_HOST=http://meilisearch:7700`.
- `.env.example` et `.env.compose.example` documentent `MEILISEARCH_HOST`, `MEILISEARCH_API_KEY` (valeurs factices) et `MEILI_MASTER_KEY`.

Les variables ne sont pas encore validées dans `start/env.ts` (à faire avec l'intégration applicative).
