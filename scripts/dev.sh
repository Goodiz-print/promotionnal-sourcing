#!/usr/bin/env bash
# Lance toutes les instances de développement : Postgres + S3 local (Docker),
# Mailpit (si installé), le worker de la queue et le serveur AdonisJS (HMR).
# Ctrl+C arrête les processus lancés ici ; les conteneurs restent actifs
# (`docker compose stop` pour les arrêter).
set -euo pipefail

cd "$(dirname "$0")/.."

[ -f .env ] || { echo "✗ .env manquant : cp .env.example .env (puis renseigner APP_KEY)"; exit 1; }
docker info >/dev/null 2>&1 || { echo "✗ Docker n'est pas démarré"; exit 1; }

echo "▶ Postgres + S3 local (Docker)…"
docker compose up -d --wait postgres s3

pids=()
cleanup() {
  trap - INT TERM EXIT
  echo; echo "■ Arrêt des processus de dev…"
  # `pkill -P` : `ace serve` lance des enfants (Vite, process HTTP) à arrêter aussi.
  for pid in "${pids[@]:-}"; do
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  done
  # `ace serve` peut ignorer SIGTERM quand il est lancé en arrière-plan : on
  # laisse 5 s, puis on force.
  for _ in 1 2 3 4 5; do
    alive=0
    for pid in "${pids[@]:-}"; do kill -0 "$pid" 2>/dev/null && alive=1; done
    [ "$alive" -eq 0 ] && break
    sleep 1
  done
  for pid in "${pids[@]:-}"; do
    pkill -9 -P "$pid" 2>/dev/null || true
    kill -9 "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

if command -v mailpit >/dev/null 2>&1; then
  echo "▶ Mailpit — http://localhost:8025"
  mailpit >/dev/null 2>&1 &
  pids+=($!)
else
  echo "• Mailpit absent (brew install mailpit) : les mails ne seront pas capturés"
fi

echo "▶ Migrations"
node ace migration:run

echo "▶ Worker de la queue"
node ace queue:work &
pids+=($!)

port="$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2)"
echo "▶ Serveur (HMR) — http://localhost:${port:-3333}"
node ace serve --hmr &
pids+=($!)

# Sort dès qu'un des processus s'arrête (le trap arrête les autres).
# Boucle plutôt que `wait -n` : indisponible dans le bash 3.2 de macOS.
while true; do
  for pid in "${pids[@]}"; do
    kill -0 "$pid" 2>/dev/null || exit 0
  done
  sleep 1
done
