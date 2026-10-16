# Script de lancement des instances de dev

> Date : 2026-10-16

`pnpm dev:all` (`scripts/dev.sh`) démarre d'un coup Postgres et le S3 local
(`docker compose up -d --wait`), Mailpit s'il est installé, applique les
migrations, puis lance le worker de la queue et le serveur (`ace serve --hmr`).
Ctrl+C arrête les processus lancés ; les conteneurs restent actifs. `pnpm dev`
reste disponible pour le serveur seul.
