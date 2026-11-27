# Claude (API Anthropic) comme second fournisseur IA

> Date : 2026-11-27

La traduction automatique et la recherche par image peuvent passer par Claude au lieu de Mistral. Ce sont les clés d'API présentes qui désignent le fournisseur, **Claude en premier** : `ANTHROPIC_API_KEY` renseignée, c'est Claude ; sinon `MISTRAL_API_KEY`, c'est Mistral ; aucune des deux, les deux fonctions sont indisponibles. Un environnement qui n'a que `MISTRAL_API_KEY` ne change pas. Décision et alternatives : [ADR 0006](../adr/0006-fournisseur-llm-mistral-ou-claude.md).

## Variables d'environnement

| Variable                   | Statut                                      | Rôle                                   |
| -------------------------- | ------------------------------------------- | -------------------------------------- |
| `ANTHROPIC_API_KEY`        | optionnelle ; sa présence active Claude     | Clé de l'API Anthropic (web et worker) |
| `CLAUDE_TRANSLATION_MODEL` | optionnelle (`claude-haiku-5-5` par défaut) | Modèle de traduction                   |
| `CLAUDE_VISION_MODEL`      | optionnelle (`claude-haiku-5-5` par défaut) | Modèle de description d'image          |

`AI_PRICE_INPUT_PER_MILLION` et `AI_PRICE_OUTPUT_PER_MILLION` existent déjà : les ajuster au tarif du modèle actif.

## Les embeddings ne changent pas

Claude n'a pas d'API d'embeddings. La recherche sémantique reste pilotée par `AI_PROVIDER` (`huggingface`, `mistral` ou `openai-compatible`, `config/search.ts`, ADR 0002). Passer à Claude n'y touche pas : avec `AI_PROVIDER=mistral`, `MISTRAL_API_KEY` reste nécessaire.

## Comportements notables

- `providers/ai_provider.ts` lie `TranslationProvider` et `ImageDescriptionProvider` au driver du fournisseur choisi (`ClaudeTranslationProvider`, `ClaudeImageDescriptionProvider`, SDK `@anthropic-ai/sdk`).
- **Ajouter `ANTHROPIC_API_KEY` à un environnement qui tournait sur Mistral le fait passer à Claude**, y compris si `MISTRAL_API_KEY` reste là pour les embeddings.
- **Changer de fournisseur ou de modèle retraduit le contenu automatique** : le modèle entre dans la clé d'idempotence. Les traductions corrigées à la main ne sont pas touchées.
- Mêmes erreurs qu'avec Mistral : réponse tronquée rejetée (le lot est scindé), réponse invalide ou refus du modèle rejetés, tokens journalisés dans `ai_calls` même sur une réponse rejetée. Sans clé du fournisseur actif, la recherche par image est indisponible (503) et `TranslateEntityJob` ne fait rien (un warning, ni échec ni réessai), sans plantage.
- Santé de la plateforme : nouveau composant `claude` (liste des modèles, aucun token consommé). `disabled` sans `ANTHROPIC_API_KEY`, `down` si la clé est refusée, `degraded` sinon. Le composant `mistral` est inchangé.
- **Refus du modèle** (`TranslationRefusedError`) : le job n'est pas rejoué, le même appel serait refacturé pour le même refus. L'appel reste journalisé `failed` dans `ai_calls`.
- **Recherche par image avec Claude** : délai de 20 s et aucun réessai du SDK (`aiConfig.vision.timeoutMs`), la requête de l'acheteur n'attend pas ; une réponse coupée par le plafond de sortie est signalée « response truncated ».
- **Coût estimé du back-office** : le tarif `AI_PRICE_*` ne s'applique plus qu'aux appels faits avec le modèle actif (`estimateLlmCost`). Les tokens restent tous comptés ; les appels d'un ancien modèle ne sont plus chiffrés à un tarif qui n'est pas le leur.
- Les modèles Claude antérieurs à la génération 4.6 ne sont pas pris en charge.

## Textes de confidentialité

- La politique de confidentialité nomme le sous-traitant IA réellement configuré : la page reçoit la prop `aiProcessor` et affiche `privacy.sections.destinataires.body` (Mistral AI) ou `bodyClaude` (Anthropic PBC, États-Unis, avec la mention du transfert de la photo vers les États-Unis), dans les 9 langues.
- La mention sous le bouton de recherche par image ne cite plus de fournisseur (« analysée par notre prestataire d'IA »).
- **À faire valider** : le texte `bodyClaude` constate le transfert hors de l'Union européenne mais n'en décrit pas l'encadrement juridique. À faire relire par le client avant d'activer la vision avec Claude.

## Tests

- `tests/unit/claude_translation_provider.spec.ts`, `tests/unit/claude_image_description_provider.spec.ts` : client Anthropic remplacé par un faux (`tests/utils/fake_claude_client.ts`), aucun appel réseau.
- `tests/unit/llm_helpers.spec.ts` : helpers de `shared/helpers/llm.ts`, dont le choix du fournisseur par les clés (`resolveLlmProvider`).
- `tests/functional/container_wiring.spec.ts` : liaison du conteneur pour chaque fournisseur.
- `tests/functional/admin_health.spec.ts` : sonde `claude`.
- `tests/unit/translate_entity_job.spec.ts` : job sans effet sans clé, refus non rejoué.
- `tests/unit/health_probe_claude.spec.ts` : sonde `claude` sans base (ok, clé refusée, dégradé, non sondé).
- `tests/functional/admin_ai.spec.ts` : coût limité aux appels du modèle actif.
- `tests/functional/marketing.spec.ts`, `tests/inertia/legal_document.spec.ts` : sous-traitant IA de la politique de confidentialité.
