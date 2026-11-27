#!/usr/bin/env bash
#
# Contrôles d'une image construite localement, avant tout push :
#   - le conteneur ne tourne pas en root ;
#   - aucune source TypeScript ni fichier .env hors node_modules ;
#   - Ghostscript est présent (compression des PDF).
# Partagé par docker-pr.yml (PR) et docker.yml (main, avant le push).
#
# Usage :
#   check_image.sh <image>

set -euo pipefail

image="${1:?Usage : check_image.sh <image>}"

test "$(docker run --rm --entrypoint id "$image" -u)" != 0
test -z "$(docker run --rm --entrypoint sh "$image" -c 'find /app -name "*.ts" ! -name "*.d.ts" -o -name ".env*"' | grep -v '^/app/node_modules/')"
docker run --rm --entrypoint gs "$image" --version
