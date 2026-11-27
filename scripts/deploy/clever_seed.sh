#!/usr/bin/env bash
#
# Peuple la base du STAGING pour les tests utilisateurs (docs/deploiement.md
# § Données du staging), depuis l'image déployée et avec les variables de
# l'application web Clever Cloud. Relançable : tout est idempotent.
#
#   1. seeders de démo (MainSeeder : rôles, catalogue fictif, 3 comptes de démo) ;
#   2. catalogues réels des fournisseurs (supplier:import, prix nets) ;
#   3. comptes de test (StagingAccountSeeder : admins nominatifs, agences et
#      fournisseurs fictifs ; rattache les fiches importées) ;
#   4. réindexation de la recherche (le rattachement ne passe pas par la queue).
#
# Usage :
#   clever_seed.sh --app <app_id_web> --image <ref> \
#     [--catalogue full|limit:<n>|none] [--skip-demo] [--dry-run]
#
# Refusé si l'APP_URL de l'application ne contient pas « staging ». Un import en
# échec (un fournisseur injoignable) n'empêche pas les étapes suivantes ; le
# script sort alors en code 1 à la fin.
# Authentification : CLEVER_TOKEN et CLEVER_SECRET. Requiert docker et jq.

set -euo pipefail

app=''
image=''
catalogue='full'
skip_demo=false
dry_run=()

while [ $# -gt 0 ]; do
  case "$1" in
    --app) app="$2"; shift 2 ;;
    --image) image="$2"; shift 2 ;;
    --catalogue) catalogue="$2"; shift 2 ;;
    --skip-demo) skip_demo=true; shift ;;
    --dry-run) dry_run=(--dry-run); shift ;;
    -h | --help) sed -n '3,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done

if [ -z "$app" ] || [ -z "$image" ]; then
  echo "--app et --image sont obligatoires." >&2
  exit 2
fi

case "$catalogue" in
  full) import='node ace supplier:import all --full --force' ;;
  none) import='' ;;
  limit:*)
    limit="${catalogue#limit:}"
    if ! [[ "$limit" =~ ^[1-9][0-9]*$ ]]; then
      echo "--catalogue limit:<n> attend un entier positif (reçu « $limit »)." >&2
      exit 2
    fi
    import="node ace supplier:import all --limit=$limit --force"
    ;;
  *) echo "--catalogue : full, limit:<n> ou none (reçu « $catalogue »)." >&2; exit 2 ;;
esac

commands=()
if [ "$skip_demo" = false ]; then
  # Sans --files, db:seed exécuterait chaque seeder isolément, dans le désordre.
  commands+=('node ace db:seed --files=database/seeders/main_seeder')
fi
if [ -n "$import" ]; then
  commands+=("$import")
fi
commands+=(
  'node ace db:seed --files=database/seeders/staging_account_seeder'
  'node ace search:reindex'
)

exec "$(dirname "$0")/clever_exec.sh" --app "$app" --image "$image" --require-url staging --keep-going \
  "${dry_run[@]}" -- "${commands[@]}"
