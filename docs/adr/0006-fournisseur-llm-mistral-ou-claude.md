# ADR 0006 : fournisseur du modèle de langage au choix, Mistral ou Claude

- **Statut** : proposé
- **Date** : 2026-11-27
- **Issues liées** : #75 (traduction automatique), #177 (suivi des appels IA), #179 (santé de la plateforme)

## Contexte

La traduction automatique du contenu et la recherche par image appellent un modèle de langage. Les deux passent déjà par une classe abstraite (`TranslationProvider`, `ImageDescriptionProvider`), mais `providers/ai_provider.ts` les liait en dur à Mistral.

On veut pouvoir utiliser Claude (API Anthropic) à la place, par configuration, sans rien changer pour un environnement qui garde sa configuration actuelle.

Contraintes :

- `AI_PROVIDER` existe déjà et choisit le fournisseur d'**embeddings** de la recherche sémantique (`huggingface`, `mistral`, `openai-compatible`, ADR 0002) ;
- l'API Anthropic **n'a pas d'endpoint d'embeddings** (vérifié dans le SDK `@anthropic-ai/sdk` : messages, lots, fichiers, modèles, aucun `embeddings`) ;
- le modèle entre dans la clé d'idempotence des traductions, et le back-office n'a qu'un tarif (`AI_PRICE_*`).

## Décision

**Ce sont les clés d'API présentes qui désignent le fournisseur de la traduction et de la description d'image, Claude en premier** : `ANTHROPIC_API_KEY` renseignée, c'est Claude ; sinon `MISTRAL_API_KEY`, c'est Mistral ; aucune des deux, les deux fonctions sont indisponibles (`resolveLlmProvider`, `shared/helpers/llm.ts`). Il n'y a pas de variable de choix.

- `AI_PROVIDER` n'est pas réutilisée : elle reste réservée aux embeddings, qui restent sur Hugging Face, Mistral ou un service OpenAI-compatible. Choisir Claude ne touche pas à la recherche sémantique.
- Deux drivers Claude (`ClaudeTranslationProvider`, `ClaudeImageDescriptionProvider`) s'appuient sur le SDK officiel `@anthropic-ai/sdk`. Le client `Anthropic` est lié une fois dans le conteneur et injecté dans les drivers et dans la sonde de santé.
- Clé : `ANTHROPIC_API_KEY`. Modèles : `CLAUDE_TRANSLATION_MODEL` et `CLAUDE_VISION_MODEL`, `claude-haiku-5-5` par défaut pour les deux.
- La réponse est demandée en sortie structurée (schéma JSON strict), puis vérifiée comme celle de Mistral. Les erreurs sont les mêmes : réponse tronquée (`TranslationTruncatedError`), réponse invalide, refus du modèle, clé absente (fonction indisponible).
- La traduction est appelée en flux (`stream` puis `finalMessage`) : avec un plafond de 30 000 tokens, le SDK refuse un appel non diffusé.

### Modèle par défaut et coût

| Modèle              | Entrée ($/M tokens) | Sortie ($/M tokens) | Par rapport à Haiku 5.5 |
| ------------------- | ------------------- | ------------------- | ----------------------- |
| `claude-haiku-5-5`  | 0,10                | 0,50                | 1×                      |
| `claude-sonnet-5-5` | 2                   | 10                  | 20×                     |
| `claude-opus-5-5`   | 4                   | 20                  | 40×                     |

Tarifs relevés le 2026-11-27, à revérifier avant de poser `AI_PRICE_*`. Haiku 5.5 est le défaut parce que la traduction d'un catalogue est un travail volumineux et simple, et que son tarif est du même ordre que celui de `mistral-small`. La réflexion du modèle est facturée comme de la sortie ; les drivers demandent un effort bas (`effort: low`) pour la limiter.

## Alternatives écartées

| Alternative                                         | Raison de l'écart                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un choix par fonction (traduction / vision)         | Deux variables, et un seul tarif `AI_PRICE_*` côté back-office. À ajouter si le besoin apparaît : les deux liaisons du provider sont déjà indépendantes.                 |
| Une variable de choix (`AI_LLM_PROVIDER`)           | Écartée à la demande du client : une variable de plus, et un fournisseur choisi sans sa clé rendait l'IA indisponible. La clé présente suffit à désigner le fournisseur. |
| Réutiliser `AI_PROVIDER`                            | Elle choisit les embeddings, que Claude ne fournit pas : `AI_PROVIDER=claude` casserait la recherche sémantique.                                                         |
| Appeler Claude par une couche « compatible OpenAI » | Pas de sortie structurée ni de types du SDK officiel.                                                                                                                    |
| Opus ou Sonnet par défaut                           | 20 à 40 fois le coût pour une tâche que le plus petit modèle traite ; reste réglable par variable.                                                                       |

## Conséquences

**Positives**

- Le fournisseur se change en posant ou en retirant une clé, sans toucher au code ; pas de combinaison incohérente possible (fournisseur choisi sans sa clé).
- Rien ne change pour un environnement qui n'a que `MISTRAL_API_KEY` : Mistral, mêmes modèles, mêmes clés d'idempotence.
- La sonde de santé suit les deux fournisseurs (composant `claude`, non sondé sans clé).

**Négatives**

- Poser `ANTHROPIC_API_KEY` suffit à basculer sur Claude, même si `MISTRAL_API_KEY` reste présente (elle sert aussi aux embeddings avec `AI_PROVIDER=mistral`) : la bascule est implicite, et elle retraduit le contenu automatique.
- **Changer de fournisseur ou de modèle retraduit le contenu automatique** : le modèle entre dans la clé d'idempotence, toutes les clés changent. Les traductions corrigées à la main (`is_auto = false`) ne sont pas touchées. Mesurer le coût avec `translation:backfill --limit=N` avant un passage en masse.
- Le journal `ai_calls` garde le modèle de chaque appel. Le coût affiché n'applique le tarif configuré qu'aux appels du modèle actif : après un changement, les anciens appels restent comptés en tokens mais ne sont plus chiffrés.
- Les modèles Claude antérieurs à la génération 4.6 ne sont pas pris en charge (paramètre `effort`).

## Points à valider avant d'activer Claude en production

- **Données personnelles** : avec Claude (`ANTHROPIC_API_KEY` présente), les photos de la recherche par image sont envoyées à Anthropic (États-Unis), plus à Mistral AI. La politique de confidentialité affiche alors la variante `bodyClaude` (`resources/lang/*/privacy.json`), qui nomme Anthropic et constate le transfert vers les États-Unis ; l'encadrement juridique de ce transfert n'y est pas décrit : texte à faire valider par le client avant d'activer la vision avec Claude.
- Mesurer la qualité de traduction sur un échantillon réel (`translation:backfill --limit=N`) avant de retraduire le catalogue.
- Poser `AI_PRICE_INPUT_PER_MILLION` / `AI_PRICE_OUTPUT_PER_MILLION` au tarif du modèle choisi.
