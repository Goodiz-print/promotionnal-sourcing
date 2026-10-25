import env from '#start/env'
import { resolveEmbeddingsEnabled } from '#shared/helpers/embeddings_activation'

/**
 * Configuration IA. Les embeddings produits alimentent la recherche sémantique
 * du catalogue (colonne `products.embedding`, pgvector — voir `docs/catalogue.md`).
 *
 * **Provider-agnostique** : `AI_PROVIDER` choisit le driver d'embeddings
 * (`mistral` natif, ou `openai-compatible` générique pour OpenAI / Together /
 * Groq / Ollama / vLLM… via `AI_BASE_URL`, `AI_API_KEY`, `AI_EMBED_MODEL`).
 *
 * `embeddings.enabled` gouverne la génération (job + calcul de l'embedding de
 * la requête). **Activée par défaut dès que le provider est configuré** : il
 * suffit de renseigner `MISTRAL_API_KEY` (ou `AI_API_KEY` / `AI_BASE_URL` pour
 * un driver compatible OpenAI). Sans identifiants, elle reste désactivée
 * (dev local, CI) et aucune API n'est appelée. En `NODE_ENV=test`, elle est
 * désactivée sauf demande explicite : la suite ne dépend jamais d'un réseau.
 * `AI_EMBEDDINGS_ENABLED=false` la coupe explicitement ; `=true` sans
 * identifiants est une erreur de configuration (échec au démarrage plutôt
 * qu'une recherche sémantique qui échoue silencieusement).
 * `embeddings.dimensions` est **figé à 1024** pour correspondre à la colonne
 * `products.embedding` — chaque provider est configuré pour réduire à cette
 * dimension.
 */
const provider = env.get('AI_PROVIDER', 'mistral')

/** Le provider choisi dispose-t-il de quoi appeler son API ? */
function providerConfigured(): boolean {
  if (provider === 'mistral') return Boolean(env.get('MISTRAL_API_KEY'))
  // Un endpoint compatible OpenAI local (Ollama, vLLM…) n'a pas de clé : l'URL suffit.
  return Boolean(env.get('AI_API_KEY') || env.get('AI_BASE_URL'))
}

const aiConfig = {
  provider,

  embeddings: {
    enabled: resolveEmbeddingsEnabled({
      provider,
      requested: env.get('AI_EMBEDDINGS_ENABLED'),
      configured: providerConfigured(),
      nodeEnv: env.get('NODE_ENV'),
    }),
    dimensions: 1024,
  },

  mistral: {
    apiKey: env.get('MISTRAL_API_KEY'),
    model: env.get('MISTRAL_EMBED_MODEL', 'mistral-embed'),
  },

  /**
   * Traduction automatique (Mistral). `promptVersion` entre dans la clé
   * d'idempotence : le bumper force la retraduction après un changement de prompt.
   */
  translation: {
    enabled: env.get('AI_TRANSLATION_ENABLED', false),
    model: env.get('MISTRAL_TRANSLATION_MODEL', 'mistral-small-latest'),
    promptVersion: 1,
  },

  openaiCompatible: {
    baseUrl: env.get('AI_BASE_URL', 'https://api.openai.com/v1'),
    apiKey: env.get('AI_API_KEY'),
    model: env.get('AI_EMBED_MODEL', 'text-embedding-3-small'),
  },
}

export default aiConfig
