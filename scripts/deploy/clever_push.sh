#!/usr/bin/env bash
#
# Déploie une image déjà construite sur une application Docker Clever Cloud.
#
# Clever Cloud ne sait pas « déployer une image » : une application Docker
# reconstruit le Dockerfile qu'on lui pousse par git. On pousse donc un dépôt
# jetable dont le seul fichier est un Dockerfile `FROM <image>@<digest>` : la
# « construction » se réduit à tirer l'image testée par la CI (ADR 0005).
#
# Usage :
#   clever_push.sh --app <app_id> --role <web|worker> --image <ref> [--dry-run]
#
# Authentification : variables CLEVER_TOKEN et CLEVER_SECRET (lues par clever-tools).
# L'application doit porter CC_DOCKER_LOGIN_SERVER/USERNAME/PASSWORD pour tirer
# une image privée (cf. docs/deploiement-clever-setup.md).

set -euo pipefail

app=''
role=''
image=''
dry_run=false

usage() {
  sed -n '3,15p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --app) app="$2"; shift 2 ;;
    --role) role="$2"; shift 2 ;;
    --image) image="$2"; shift 2 ;;
    --dry-run) dry_run=true; shift ;;
    -h | --help) usage ;;
    *) echo "Option inconnue : $1" >&2; usage 2 ;;
  esac
done

if [ -z "$role" ] || [ -z "$image" ]; then
  echo "--role et --image sont obligatoires." >&2
  usage 2
fi

# L'image se déploie au digest : un tag peut être réécrit, et un redémarrage
# Clever réutiliserait alors silencieusement l'ancienne image.
case "$image" in
  *@sha256:*) ;;
  *) echo "L'image doit être référencée par digest (…@sha256:…) : $image" >&2; exit 2 ;;
esac

dockerfile() {
  echo "FROM $image"
  case "$role" in
    web)
      # Commande par défaut de l'image : node bin/server.js.
      echo 'ENV PORT=8080 HOST=0.0.0.0'
      ;;
    worker)
      # queue:work + sonde HTTP : Clever Cloud exige un conteneur qui écoute.
      echo 'ENV PORT=8080 HOST=0.0.0.0'
      echo 'CMD ["node", "ace", "queue:serve"]'
      ;;
    *)
      echo "Rôle inconnu : $role (web, worker)" >&2
      exit 2
      ;;
  esac
}

content="$(dockerfile)"

if [ "$dry_run" = true ]; then
  echo "# Dockerfile poussé sur ${app:-<app_id>} (rôle $role) :"
  echo "$content"
  exit 0
fi

if [ -z "$app" ]; then
  echo "--app est obligatoire hors --dry-run." >&2
  exit 2
fi
if [ -z "${CLEVER_TOKEN:-}" ] || [ -z "${CLEVER_SECRET:-}" ]; then
  echo "CLEVER_TOKEN et CLEVER_SECRET doivent être définis." >&2
  exit 2
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

cd "$workdir"
echo "$content" > Dockerfile

git init --quiet --initial-branch=main
git add Dockerfile
git -c user.name='deploy' -c user.email='deploy@localhost' commit --quiet -m "deploy($role): $image"

clever link "$app" --alias target

echo "Déploiement de $image sur $app (rôle $role)…"
# --force : chaque déploiement part d'un dépôt neuf, sans historique commun.
# clever deploy suit le déploiement et sort en erreur s'il échoue.
clever deploy --alias target --force --same-commit-policy rebuild
