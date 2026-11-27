#!/usr/bin/env bash
#
# Dit si un commit de main a déjà été testé par la CI de sa pull request, pour
# ne pas rejouer toute la CI après un merge (quota de minutes GitHub Actions).
#
# Un commit est « testé » si :
#   1. il provient d'une PR mergée ;
#   2. le run CI le plus récent sur la tête de cette PR (événement pull_request) a
#      réussi, avec au moins un job réellement exécuté : un push sur une PR en
#      brouillon donne un run « success » dont tous les jobs sont sautés, qui ne
#      prouve rien ;
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

run="$(gh api "repos/$repo/actions/workflows/ci.yml/runs?head_sha=$head&event=pull_request&per_page=1" \
  --jq '.workflow_runs | first | "\(.id) \(.conclusion)"' 2> /dev/null)" || report false "API indisponible, CI rejouée."
read -r run_id conclusion <<< "$run"
if [ -z "$run" ] || [ "$conclusion" != 'success' ]; then
  report false "dernier run CI de la tête \`$head\` de la PR #$number pas vert ($conclusion), CI rejouée."
fi

ran="$(gh api "repos/$repo/actions/runs/$run_id/jobs?per_page=100" \
  --jq '[.jobs[] | select(.conclusion == "success")] | length' 2> /dev/null)" \
  || report false "API indisponible, CI rejouée."
if [ "$ran" = '0' ]; then
  report false "run CI #$run_id entièrement sauté (PR en brouillon ?), CI rejouée."
fi

commit_tree="$(tree_of "$sha" 2> /dev/null)" || report false "API indisponible, CI rejouée."
head_tree="$(tree_of "$head" 2> /dev/null)" || report false "API indisponible, CI rejouée."
if [ "$commit_tree" != "$head_tree" ]; then
  report false "contenu différent de la tête testée de la PR #$number (PR pas à jour avec main), CI rejouée."
fi

report true "identique à la tête \`$head\` de la PR #$number, déjà testée : CI non rejouée."
