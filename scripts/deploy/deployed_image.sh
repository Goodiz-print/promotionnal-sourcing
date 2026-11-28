#!/usr/bin/env bash
#
# Affiche l'image servie par un environnement : la version annoncée par
# GET <app_url>/health (commit de l'image), sous son tag GHCR. Son code
# correspond au schéma de la base (migrations passées au déploiement).
#
# Usage :
#   deployed_image.sh <app_url> <dépôt GitHub (owner/nom)>

set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage : deployed_image.sh <app_url> <owner/nom>" >&2
  exit 2
fi

app_url="$1"
repository="$2"

# Tolère un APP_URL saisi avec un `/` final : `//health` répond 404 (HTML).
health_url="${app_url%/}/health"

version="$(curl --silent --show-error --fail --max-time 10 "$health_url" | jq -r '.version // empty')"
if [ -z "$version" ]; then
  echo "$health_url n'annonce aucune version : environnement déployé ?" >&2
  exit 1
fi

# GHCR refuse les majuscules, et le nom de l'organisation en contient.
echo "ghcr.io/${repository,,}:$version"
