import env from '#start/env'

/**
 * Configuration IA. Les embeddings produits alimentent la recherche sémantique
 * du catalogue (colonne `products.embedding`, pgvector — voir `docs/catalogue.md`).
 *
 * **Provider-agnostique** : `AI_PROVIDER` choisit le driver d'embeddings
 * (`mistral` natif, ou `openai-compatible` générique pour OpenAI / Together /
 * Groq / Ollama / vLLM… via `AI_BASE_URL`, `AI_API_KEY`, `AI_EMBED_MODEL`).
 *
 * `embeddings.enabled` gouverne la génération (job + calcul de l'embedding de
 * la requête). **Désactivé par défaut** (dev / test / CI) : aucune API n'est
 * appelée. `embeddings.dimensions` est **figé à 1024** pour correspondre à la
 * colonne `products.embedding` — chaque provider est configuré pour réduire à
 * cette dimension.
 */
const aiConfig = {
  provider: env.get('AI_PROVIDER', 'mistral'),

  embeddings: {
    enabled: env.get('AI_EMBEDDINGS_ENABLED', false),
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
