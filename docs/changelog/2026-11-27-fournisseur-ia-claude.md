# Claude (API Anthropic) comme second fournisseur IA

> Date : 2026-11-27

La traduction automatique et la recherche par image peuvent passer par Claude au lieu de Mistral. Le choix se fait par configuration ; Mistral reste le défaut et rien ne change pour un environnement qui ne touche pas à ses variables. Décision et alternatives : [ADR 0006](../adr/0006-fournisseur-llm-mistral-ou-claude.md).

## Variables d'environnement

| Variable                   | Statut                                      | Rôle                                                       |
| -------------------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `AI_LLM_PROVIDER`          | optionnelle (`mistral` par défaut)          | `mistral` ou `claude`, pour la traduction **et** la vision |
| `ANTHROPIC_API_KEY`        | obligatoire si `AI_LLM_PROVIDER=claude`     | Clé de l'API Anthropic (web et worker)                     |
| `CLAUDE_TRANSLATION_MODEL` | optionnelle (`claude-haiku-5-5` par défaut) | Modèle de traduction                                       |
| `CLAUDE_VISION_MODEL`      | optionnelle (`claude-haiku-5-5` par défaut) | Modèle de description d'image                              |

`AI_PRICE_INPUT_PER_MILLION` et `AI_PRICE_OUTPUT_PER_MILLION` existent déjà : les ajuster au tarif du modèle actif.

## Les embeddings ne changent pas

Claude n'a pas d'API d'embeddings. La recherche sémantique reste pilotée par `AI_PROVIDER` (`huggingface`, `mistral` ou `openai-compatible`, `config/search.ts`, ADR 0002). `AI_LLM_PROVIDER=claude` n'y touche pas : avec `AI_PROVIDER=mistral`, `MISTRAL_API_KEY` reste nécessaire.

## Comportements notables

- `providers/ai_provider.ts` lie `TranslationProvider` et `ImageDescriptionProvider` au driver du fournisseur choisi (`ClaudeTranslationProvider`, `ClaudeImageDescriptionProvider`, SDK `@anthropic-ai/sdk`).
- **Changer de fournisseur ou de modèle retraduit le contenu automatique** : le modèle entre dans la clé d'idempotence. Les traductions corrigées à la main ne sont pas touchées.
- Mêmes erreurs qu'avec Mistral : réponse tronquée rejetée (le lot est scindé), réponse invalide ou refus du modèle rejetés, tokens journalisés dans `ai_calls` même sur une réponse rejetée. Sans clé du fournisseur actif, la recherche par image est indisponible (503), sans plantage.
- Santé de la plateforme : nouveau composant `claude` (liste des modèles, aucun token consommé). `disabled` sans `ANTHROPIC_API_KEY`, `down` si la clé est refusée, `degraded` sinon. Le composant `mistral` est inchangé.
- Les modèles Claude antérieurs à la génération 4.6 ne sont pas pris en charge.

## À faire avant d'activer la vision avec Claude

Les textes de confidentialité citent Mistral AI comme sous-traitant de la recherche par image (`privacy.json`, `products.json`). Avec Claude, les photos partent chez Anthropic : faire corriger ces textes avant l'activation.

## Tests

- `tests/unit/claude_translation_provider.spec.ts`, `tests/unit/claude_image_description_provider.spec.ts` : client Anthropic remplacé par un faux (`tests/utils/fake_claude_client.ts`), aucun appel réseau.
- `tests/unit/llm_helpers.spec.ts` : helpers de `shared/helpers/llm.ts`.
- `tests/functional/container_wiring.spec.ts` : Mistral par défaut, un driver par fournisseur.
- `tests/functional/admin_health.spec.ts` : sonde `claude`.
