#!/usr/bin/env bash
#
# Lance des commandes dans une image, avec les variables (base, clés…) d'une
# application Clever Cloud lues au moment de l'exécution : aucun identifiant
# n'est stocké dans GitHub. Utilisé par clever_migrate.sh et clever_seed.sh.
#
# Usage :
#   clever_exec.sh --app <app_id> --image <ref> [--require-url <motif>] [--keep-going] \
#     [--dry-run] -- '<commande 1>' ['<commande 2>' …]
#
# --require-url : refuse si l'APP_URL de l'application ne contient pas <motif>.
# --keep-going : une commande en échec n'arrête pas les suivantes ; sortie 1 à la fin.
# Authentification : CLEVER_TOKEN et CLEVER_SECRET. Requiert docker et jq.

set -euo pipefail

app=''
image=''
require_url=''
keep_going=false
dry_run=false

while [ $# -gt 0 ]; do
  case "$1" in
    --app) app="$2"; shift 2 ;;
    --image) image="$2"; shift 2 ;;
    --require-url) require_url="$2"; shift 2 ;;
    --keep-going) keep_going=true; shift ;;
    --dry-run) dry_run=true; shift ;;
    --) shift; break ;;
    -h | --help) sed -n '3,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done

if [ -z "$app" ] || [ -z "$image" ] || [ $# -eq 0 ]; then
  echo "--app, --image et au moins une commande (après --) sont obligatoires." >&2
  exit 2
fi

if [ "$dry_run" = true ]; then
  echo "# Variables lues sur $app${require_url:+ (APP_URL doit contenir « $require_url »)}, puis, dans $image :"
  printf '%s\n' "$@"
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

if [ -n "$require_url" ] && ! grep '^APP_URL=' "$env_file" | grep -qF "$require_url"; then
  echo "L'APP_URL de $app ne contient pas « $require_url » : refusé." >&2
  exit 1
fi

failed=()
for command in "$@"; do
  echo "→ $command"
  # shellcheck disable=SC2086
  if docker run --rm --env-file "$env_file" "$image" $command; then
    continue
  fi
  if [ "$keep_going" = false ]; then
    exit 1
  fi
  failed+=("$command")
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "Commandes en échec :" >&2
  printf '  %s\n' "${failed[@]}" >&2
  exit 1
fi
