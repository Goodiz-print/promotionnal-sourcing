#!/usr/bin/env bash
#
# Dit si un commit de main a déjà été testé par la CI de sa pull request, pour
# ne pas rejouer toute la CI après un merge (quota de minutes GitHub Actions).
#
# Un commit est « testé » si :
#   1. il provient d'une PR mergée ;
#   2. le workflow CI a réussi, sur l'événement pull_request, pour la tête de cette PR ;
#   3. son arbre (le contenu des fichiers) est identique à celui de la tête de la PR.
# Le point 3 est vrai pour un squash ou un rebase d'une PR à jour avec main. Si main
# avait bougé entre-temps, le contenu mergé n'a jamais été testé : réponse « false ».
#
# Usage :
#   commit_tested.sh <sha>
#
# Écrit `tested=true|false` dans $GITHUB_OUTPUT (sinon sur la sortie standard), et
# la raison dans $GITHUB_STEP_SUMMARY si défini. Toute erreur d'API donne « false » :
# en cas de doute, on teste. Authentification : GH_TOKEN (lu par gh).
# Dépôt : GITHUB_REPOSITORY (owner/nom), sinon celui du répertoire courant.

set -euo pipefail

sha="${1:?Usage : commit_tested.sh <sha>}"
repo="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

report() {
  local tested="$1" reason="$2"
  echo "tested=$tested" >> "${GITHUB_OUTPUT:-/dev/stdout}"
  echo "$reason"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "Commit \`$sha\` : $reason" >> "$GITHUB_STEP_SUMMARY"
  fi
  exit 0
}

tree_of() {
  gh api "repos/$repo/git/commits/$1" --jq '.tree.sha'
}

pr="$(gh api "repos/$repo/commits/$sha/pulls" \
  --jq '[.[] | select(.merged_at != null)] | first | "\(.number) \(.head.sha)"' 2> /dev/null)" \
  || report false "API indisponible, CI rejouée."
if [ -z "$pr" ] || [ "$pr" = 'null null' ]; then
  report false "aucune PR mergée (push direct ?), CI rejouée."
fi
read -r number head <<< "$pr"

successes="$(gh api "repos/$repo/actions/workflows/ci.yml/runs?head_sha=$head&event=pull_request&status=success&per_page=1" \
  --jq '.total_count' 2> /dev/null)" || report false "API indisponible, CI rejouée."
if [ "$successes" = '0' ]; then
  report false "pas de CI verte sur la tête \`$head\` de la PR #$number, CI rejouée."
fi

commit_tree="$(tree_of "$sha" 2> /dev/null)" || report false "API indisponible, CI rejouée."
head_tree="$(tree_of "$head" 2> /dev/null)" || report false "API indisponible, CI rejouée."
if [ "$commit_tree" != "$head_tree" ]; then
  report false "contenu différent de la tête testée de la PR #$number (PR pas à jour avec main), CI rejouée."
fi

report true "identique à la tête \`$head\` de la PR #$number, déjà testée : CI non rejouée."
