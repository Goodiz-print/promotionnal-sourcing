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
dry_run=()

while [ $# -gt 0 ]; do
  case "$1" in
    --app) app="$2"; shift 2 ;;
    --image) image="$2"; shift 2 ;;
    --dry-run) dry_run=(--dry-run); shift ;;
    -h | --help) sed -n '3,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done

if [ -z "$app" ] || [ -z "$image" ]; then
  echo "--app et --image sont obligatoires." >&2
  exit 2
fi

exec "$(dirname "$0")/clever_exec.sh" --app "$app" --image "$image" "${dry_run[@]}" -- \
  'node ace migration:run --force' \
  'node ace queue:migrate'
