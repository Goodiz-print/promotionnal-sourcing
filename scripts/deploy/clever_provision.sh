#!/usr/bin/env bash
#
# Crée ou met à niveau l'infrastructure Clever Cloud d'un environnement
# (applications web et worker, PostgreSQL, Cellar, variables non secrètes).
#
# Idempotent : relancer le script ne recrée rien, il réaligne tailles, liens et
# variables sur scripts/deploy/environments/<environnement>.env.
# Aucun secret n'est lu ni écrit dans le dépôt : les identifiants des add-ons
# sont copiés de Clever Cloud vers Clever Cloud, et le script liste les secrets
# qu'il reste à poser à la main.
#
# Usage :
#   clever_provision.sh <staging|production> [--dry-run]
#
# Prérequis : clever-tools (`clever login` ou CLEVER_TOKEN/CLEVER_SECRET), jq,
# openssl. Procédure complète : docs/deploiement-clever-setup.md.

set -euo pipefail

environment="${1:-}"
dry_run=false
[ "${2:-}" = '--dry-run' ] && dry_run=true

here="$(cd "$(dirname "$0")" && pwd)"
params="$here/environments/$environment.env"

if [ -z "$environment" ] || [ ! -f "$params" ]; then
  echo "Usage : $0 <staging|production> [--dry-run]" >&2
  exit 2
fi

# shellcheck source=/dev/null
. "$params"

: "${CLEVER_ORG:?}" "${APP_PREFIX:?}" "${REGION:?}"
: "${WEB_FLAVOR:?}" "${WEB_INSTANCES:?}" "${WORKER_FLAVOR:?}"
: "${PG_PLAN:?}" "${PG_VERSION:?}" "${CELLAR_BUCKET:?}"

if [ -z "${APP_DOMAIN:-}" ]; then
  echo "APP_DOMAIN est vide dans $params : à renseigner avant de provisionner." >&2
  [ "$dry_run" = true ] || exit 2
  APP_DOMAIN='<APP_DOMAIN>'
fi

web_name="$APP_PREFIX-web"
worker_name="$APP_PREFIX-worker"
pg_name="$APP_PREFIX-pg"
cellar_name="$APP_PREFIX-cellar"

# `clever create` écrit un .clever.json dans le dossier courant : on travaille
# dans un dossier jetable pour ne rien laisser dans le dépôt.
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
cd "$workdir"

say() { printf '\n== %s\n' "$*"; }

# Exécute une commande qui modifie Clever Cloud, ou l'affiche en --dry-run.
run() {
  if [ "$dry_run" = true ]; then
    printf '  $'
    printf ' %s' "$@"
    printf '\n'
  else
    "$@"
  fi
}

# Les lectures sont sautées en --dry-run (aucun identifiant requis) : le script
# affiche alors les commandes d'une création complète.
app_id() {
  [ "$dry_run" = true ] && return 0
  clever applications list --org "$CLEVER_ORG" --format json \
    | jq -r --arg name "$1" '.[].applications[] | select(.name == $name) | .app_id' | head -n 1
}

addon_id() {
  [ "$dry_run" = true ] && return 0
  clever addon list --org "$CLEVER_ORG" --format json \
    | jq -r --arg name "$1" '.[] | select(.name == $name) | .addonId' | head -n 1
}

app_env_json() {
  if [ "$dry_run" = true ]; then
    echo '{"env":[],"fromAddons":[]}'
  else
    clever env --app "$1" --format json
  fi
}

ensure_app() {
  local name="$1" id
  id="$(app_id "$name")"
  if [ -z "$id" ]; then
    run clever create --type docker "$name" --org "$CLEVER_ORG" --region "$REGION" --alias "$name" >&2
    id="$(app_id "$name")"
  fi
  echo "${id:-<id de $name>}"
}

ensure_addon() {
  local provider="$1" name="$2" id
  shift 2
  id="$(addon_id "$name")"
  if [ -z "$id" ]; then
    run clever addon create "$provider" "$name" --org "$CLEVER_ORG" --region "$REGION" --yes "$@" >&2
    id="$(addon_id "$name")"
  fi
  echo "${id:-<id de $name>}"
}

ensure_link() {
  local app="$1" addon="$2"
  if app_env_json "$app" | jq -e --arg id "$addon" 'any(.fromAddons[]; .addonId == $id)' > /dev/null; then
    return 0
  fi
  run clever service link-addon "$addon" --app "$app"
}

# Pose sur une application les variables nommées, en prenant leur valeur dans
# l'environnement du script : aucune valeur ne passe en argument de commande.
set_vars() {
  local app="$1" names
  shift
  names="$(IFS=,; echo "$*")"
  run clever env import-vars "$names" --app "$app"
}

# Valeur d'une variable d'add-on (hôte, mot de passe…), vide en --dry-run.
addon_var() {
  [ "$dry_run" = true ] && return 0
  clever addon env "$1" --format json | jq -r --arg name "$2" '.[$name] // empty'
}

say "Applications ($CLEVER_ORG)"
web="$(ensure_app "$web_name")"
worker="$(ensure_app "$worker_name")"
echo "  web    : $web"
echo "  worker : $worker"

say 'Add-ons'
pg="$(ensure_addon postgresql-addon "$pg_name" --plan "$PG_PLAN" --addon-version "$PG_VERSION")"
cellar="$(ensure_addon cellar-addon "$cellar_name")"
echo "  postgresql : $pg"
echo "  cellar     : $cellar"
for app in "$web" "$worker"; do
  ensure_link "$app" "$pg"
  ensure_link "$app" "$cellar"
done

say 'Tailles'
run clever scale --app "$web" --flavor "$WEB_FLAVOR" --instances "$WEB_INSTANCES"
run clever scale --app "$worker" --flavor "$WORKER_FLAVOR" --instances 1
run clever config update --app "$web" --enable-force-https --enable-zero-downtime

say 'Domaine'
if [ "$dry_run" = true ] || ! clever domain --app "$web" --format json | grep -Fq "$APP_DOMAIN"; then
  run clever domain add "$APP_DOMAIN" --app "$web"
fi

say 'Variables'
# Non secrètes : communes aux deux applications.
export NODE_ENV=production TZ=UTC HOST=0.0.0.0 PORT=8080
export LOG_LEVEL="${LOG_LEVEL:-info}"
export APP_URL="https://$APP_DOMAIN"
export SESSION_DRIVER=cookie QUEUE_DRIVER=database LIMITER_STORE=database
export MAIL_FROM_ADDRESS="${MAIL_FROM_ADDRESS:?}" MAIL_FROM_NAME="${MAIL_FROM_NAME:?}"
export CC_DOCKER_LOGIN_SERVER=ghcr.io
export CELLAR_BUCKET
common=(NODE_ENV TZ HOST PORT LOG_LEVEL APP_URL SESSION_DRIVER QUEUE_DRIVER LIMITER_STORE
  MAIL_FROM_ADDRESS MAIL_FROM_NAME CC_DOCKER_LOGIN_SERVER CELLAR_BUCKET)

# Identifiants des add-ons, recopiés sous les noms attendus par start/env.ts.
DB_HOST="$(addon_var "$pg" POSTGRESQL_ADDON_HOST)"
DB_PORT="$(addon_var "$pg" POSTGRESQL_ADDON_PORT)"
DB_USER="$(addon_var "$pg" POSTGRESQL_ADDON_USER)"
DB_PASSWORD="$(addon_var "$pg" POSTGRESQL_ADDON_PASSWORD)"
DB_DATABASE="$(addon_var "$pg" POSTGRESQL_ADDON_DB)"
CELLAR_ENDPOINT="$(addon_var "$cellar" CELLAR_ADDON_HOST)"
CELLAR_ACCESS_KEY_ID="$(addon_var "$cellar" CELLAR_ADDON_KEY_ID)"
CELLAR_SECRET_ACCESS_KEY="$(addon_var "$cellar" CELLAR_ADDON_KEY_SECRET)"
export DB_HOST DB_PORT DB_USER DB_PASSWORD DB_DATABASE
export CELLAR_ENDPOINT CELLAR_ACCESS_KEY_ID CELLAR_SECRET_ACCESS_KEY
derived=(DB_HOST DB_PORT DB_USER DB_PASSWORD DB_DATABASE
  CELLAR_ENDPOINT CELLAR_ACCESS_KEY_ID CELLAR_SECRET_ACCESS_KEY)

if [ "$dry_run" != true ]; then
  for name in "${derived[@]}"; do
    [ -n "${!name}" ] || { echo "Valeur introuvable pour $name (add-on pas encore prêt ?)." >&2; exit 1; }
  done
fi

set_vars "$web" "${common[@]}" "${derived[@]}"
set_vars "$worker" "${common[@]}" "${derived[@]}"

# Plusieurs instances web : le temps réel doit passer par PostgreSQL.
if [ "$WEB_INSTANCES" -gt 1 ]; then
  export TRANSMIT_TRANSPORT=postgres
  set_vars "$web" TRANSMIT_TRANSPORT
fi

# APP_KEY : générée une fois, identique sur web et worker (chiffrement partagé).
# Jamais affichée, jamais régénérée (cela invaliderait sessions et données chiffrées).
existing_key="$(app_env_json "$web" | jq -r '.env[] | select(.name == "APP_KEY") | .value')"
if [ -z "$existing_key" ]; then
  echo '  APP_KEY absente : génération.'
  existing_key="$(openssl rand -base64 32)"
fi
export APP_KEY="$existing_key"
set_vars "$web" APP_KEY
set_vars "$worker" APP_KEY

say 'Secrets à poser à la main'
required=(SMTP_HOST SMTP_PORT SMTP_SECURE CC_DOCKER_LOGIN_USERNAME CC_DOCKER_LOGIN_PASSWORD)
missing=0
for app in "$web" "$worker"; do
  present="$(app_env_json "$app" | jq -r '.env[].name')"
  for name in "${required[@]}"; do
    if ! grep -qx "$name" <<< "$present"; then
      echo "  clever env set $name '<valeur>' --app $app"
      missing=1
    fi
  done
done
[ "$missing" = 0 ] && echo '  Aucun : les secrets obligatoires sont en place.'
echo '  Optionnels : SMTP_USERNAME, SMTP_PASSWORD, MISTRAL_API_KEY, MEILISEARCH_HOST,'
echo '  MEILISEARCH_API_KEY, HEALTH_TOKEN, MAIL_ALERT_ADDRESS (voir .env.example).'

say 'À reporter dans GitHub'
echo "  Environnement « $environment » → variables :"
echo "    CLEVER_APP_WEB=$web"
echo "    CLEVER_APP_WORKER=$worker"
echo "    APP_URL=https://$APP_DOMAIN"
echo "  Bucket Cellar à créer s'il n'existe pas : $CELLAR_BUCKET (add-on $cellar_name)."
