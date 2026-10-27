import env from '#start/env'

/**
 * Configuration IA. Reste ici la **traduction automatique** (Mistral). Les
 * embeddings ne sont plus calculés par l'application : Elasticsearch les calcule
 * lui-même, voir `config/search.ts` (`embedder`) et l'ADR 0004.
 */
const aiConfig = {
  mistral: {
    apiKey: env.get('MISTRAL_API_KEY'),
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
}

export default aiConfig
