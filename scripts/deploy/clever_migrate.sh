#!/usr/bin/env bash
#
# Lance les migrations d'un environnement AVANT le déploiement des applications,
# depuis l'image qui va être déployée (docs/deploiement.md § Migrations).
#
# Les variables (base, clés…) sont lues sur l'application web Clever Cloud au
# moment de l'exécution : aucun identifiant de base n'est stocké dans GitHub.
#
# Usage :
#   clever_migrate.sh --app <app_id_web> --image <ref> [--dry-run]
#
# Authentification : CLEVER_TOKEN et CLEVER_SECRET. Requiert docker et jq.

set -euo pipefail

app=''
image=''
dry_run=false

while [ $# -gt 0 ]; do
  case "$1" in
    --app) app="$2"; shift 2 ;;
    --image) image="$2"; shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    -h | --help) sed -n '3,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done

if [ -z "$app" ] || [ -z "$image" ]; then
  echo "--app et --image sont obligatoires." >&2
  exit 2
fi

commands=(
  'node ace migration:run --force'
  'node ace queue:migrate'
)

if [ "$dry_run" = true ]; then
  echo "# Variables lues sur $app, puis, dans $image :"
  printf '%s\n' "${commands[@]}"
  exit 0
fi

env_file="$(mktemp)"
trap 'rm -f "$env_file"' EXIT
chmod 600 "$env_file"

# Variables de l'application, puis des add-ons liés. Format `docker --env-file` :
# NOM=valeur, sans guillemets. Une valeur sur plusieurs lignes n'y est pas
# représentable : on échoue plutôt que de tronquer en silence.
clever env --app "$app" --format json \
  | jq -r '
      ([.env[]] + [.fromAddons[].env[]] + [.fromDependencies[].env[]])
      | map(select(.name | startswith("CC_") | not))
      | if any(.[]; .value | contains("\n"))
        then error("variable multi-ligne non supportée")
        else .[] | "\(.name)=\(.value)"
        end
    ' > "$env_file"

if ! grep -q '^DB_HOST=' "$env_file"; then
  echo "DB_HOST absent des variables de $app : provisioning incomplet ?" >&2
  exit 1
fi

for command in "${commands[@]}"; do
  echo "→ $command"
  # shellcheck disable=SC2086
  docker run --rm --env-file "$env_file" "$image" $command
done
